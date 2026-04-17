"use client";
import { useState, useCallback, useRef } from "react";
import type { Dispatch } from "react";
import type { Message, SessionAction } from "@/types/chat";
import { sanitizeInput, MAX_PROMPT_LENGTH } from "@/lib/sanitize";

const MAX_RETRIES = 2; // 3 total attempts
const RETRY_BASE_MS = 1_000;
const RETRY_CAP_MS = 30_000;

function retryDelay(attempt: number): number {
  // Full-jitter exponential backoff: random(0, min(cap, base * 2^attempt))
  // Distributes retries across the window to avoid thundering herd.
  const ceiling = Math.min(RETRY_CAP_MS, RETRY_BASE_MS * 2 ** attempt);
  return Math.random() * ceiling;
}

type UseChatOptions = {
  sessionId: string;
  activeMessages: Message[];
  dispatch: Dispatch<SessionAction>;
};

export function useChat({
  sessionId,
  activeMessages,
  dispatch,
}: UseChatOptions) {
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  }, []);

  // Streams a single attempt. Assumes the empty assistant message has already
  // been added via appendAssistant. Returns true on clean [DONE], false on
  // a dropped connection (triggering a retry from the caller).
  const streamFromApi = useCallback(
    async (messages: Message[], signal: AbortSignal): Promise<boolean> => {
      const res = await fetch("/api/generate/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
        signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        dispatch({
          type: "setLastError",
          sessionId,
          error: data.error ?? "Request failed",
        });
        return true; // non-retriable HTTP error
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";
      let pendingChunk = "";

      // Accumulate chunks between flushes so re-renders are capped to ~20/s
      // regardless of how fast the server sends.
      const flushInterval = setInterval(() => {
        if (!pendingChunk) return;
        const toFlush = pendingChunk;
        pendingChunk = "";
        dispatch({ type: "appendChunk", sessionId, chunk: toFlush });
      }, 50);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);
            if (payload === "[DONE]") return true;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.chunk) {
                pendingChunk += parsed.chunk;
              }
              if (parsed.error) {
                // Backend signaled an error — show immediately, no retry.
                pendingChunk = "";
                dispatch({
                  type: "setLastError",
                  sessionId,
                  error: parsed.error,
                });
                return true;
              }
            } catch {}
          }
        }
      } finally {
        // Release the reader's lock on res.body so the stream can be garbage
        // collected. A ReadableStream can only have one active reader at a time —
        // without this, the lock persists even after abort, preventing the browser
        // from cleaning up the underlying resource.
        reader.releaseLock();
        clearInterval(flushInterval);
        if (pendingChunk) {
          dispatch({ type: "appendChunk", sessionId, chunk: pendingChunk });
        }
      }

      // Loop exited via done===true without receiving [DONE]: connection dropped.
      return false;
    },
    [dispatch, sessionId],
  );

  // Adds the empty assistant message once, then retries streamFromApi up to
  // MAX_RETRIES times on dropped connections or network errors.
  const runWithRetry = useCallback(
    async (messages: Message[], signal: AbortSignal) => {
      dispatch({ type: "appendAssistant", sessionId });

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          await new Promise<void>((resolve) =>
            setTimeout(resolve, retryDelay(attempt - 1)),
          );
          if (signal.aborted) return;
          dispatch({ type: "resetLastAssistant", sessionId });
        }

        try {
          const success = await streamFromApi(messages, signal);
          if (success || signal.aborted) return;
          // success === false: dropped connection, loop continues to retry
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") return;
          if (attempt === MAX_RETRIES) throw err;
          // Network error on a non-final attempt — retry
        }
      }

      dispatch({
        type: "setLastError",
        sessionId,
        error: "Connection lost. Please try again.",
      });
    },
    [dispatch, sessionId, streamFromApi],
  );

  const sendMessage = useCallback(
    async (prompt: string) => {
      const sanitized = sanitizeInput(prompt);
      if (!sanitized.trim() || loading || sanitized.length > MAX_PROMPT_LENGTH)
        return;
      prompt = sanitized;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const newMessage: Message = { role: "user", content: prompt };
      const isFirst = activeMessages.length === 0;
      dispatch({
        type: "sendMessage",
        sessionId,
        message: newMessage,
        newTitle: isFirst ? prompt.slice(0, 40) : undefined,
      });
      setLoading(true);

      // Build history locally — React state update from dispatch above is async
      // so activeMessages doesn't yet include the new message.
      const history = [...activeMessages, newMessage];

      try {
        await runWithRetry(history, controller.signal);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        dispatch({
          type: "setLastError",
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setLoading(false);
        }
      }
    },
    [loading, sessionId, activeMessages, dispatch, runWithRetry],
  );

  const editAndResend = useCallback(
    async (index: number, newContent: string) => {
      const sanitized = sanitizeInput(newContent);
      if (!sanitized.trim() || sanitized.length > MAX_PROMPT_LENGTH) return;
      newContent = sanitized;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const editedMessage: Message = { role: "user", content: newContent };
      dispatch({
        type: "editAndResend",
        sessionId,
        index,
        message: editedMessage,
      });
      setLoading(true);

      // Reconstruct the history up to and including the edited message.
      const history = [...activeMessages.slice(0, index), editedMessage];

      try {
        await runWithRetry(history, controller.signal);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        dispatch({
          type: "setLastError",
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setLoading(false);
        }
      }
    },
    [sessionId, dispatch, runWithRetry],
  );

  return { loading, sendMessage, abort, editAndResend };
}
