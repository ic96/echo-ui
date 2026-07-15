"use client";
import { useCallback, useRef, useState } from "react";
import type { Dispatch } from "react";
import type { Message, SessionAction } from "@/types/chat";
import type { SpotifyItem, SpotifySearchType, SpotifyTrack, VoiceError } from "@/types/voice";

function pickMimeType(): string | undefined {
  const candidates = ["audio/webm", "audio/mp4", "audio/ogg"];
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type));
}

type UseVoiceSearchOptions = {
  sessionId: string;
  activeMessages: Message[];
  dispatch: Dispatch<SessionAction>;
  searchType: SpotifySearchType;
};

// Drops a query's result straight into the chat session: the query lands as
// a user message, the Spotify match(es) as an assistant message carrying
// track/result cards. Shared by voice (after transcription) and typed input
// (searchText, below) — the only difference is voice also speaks the result.
export function useVoiceSearch({ sessionId, activeMessages, dispatch, searchType }: UseVoiceSearchOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<VoiceError | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const runSearchPipeline = useCallback(
    async (text: string, speak: boolean) => {
      setIsBusy(true);
      try {
        const isFirst = activeMessages.length === 0;
        dispatch({
          type: "sendMessage",
          sessionId,
          message: { role: "user", content: text },
          newTitle: isFirst ? text.slice(0, 40) : undefined,
        });

        const searchRes = await fetch(
          `/api/spotify/search?q=${encodeURIComponent(text)}&type=${searchType}`,
        );
        const searchData = await searchRes.json();
        if (!searchRes.ok) {
          setError({ type: "api", message: searchData.error ?? "Search failed" });
          return;
        }

        let confirmation: string;
        if (searchType === "track") {
          const tracks: SpotifyTrack[] = searchData.tracks ?? [];
          if (tracks.length === 0) {
            setError({ type: "no-match" });
            return;
          }
          const top = tracks[0];
          confirmation =
            tracks.length > 1
              ? `Found ${tracks.length} matches — top one is ${top.name} by ${top.artists[0]}`
              : `Found it — ${top.name} by ${top.artists[0]}`;
          dispatch({ type: "appendTrackResult", sessionId, content: confirmation, tracks });
        } else {
          const items: SpotifyItem[] = searchData.items ?? [];
          if (items.length === 0) {
            setError({ type: "no-match" });
            return;
          }
          const top = items[0];
          confirmation =
            items.length > 1
              ? `Found ${items.length} results — top one is ${top.name}`
              : `Found it — ${top.name}`;
          dispatch({ type: "appendSearchResults", sessionId, content: confirmation, results: items });
        }

        if (!speak) return;
        try {
          const speakRes = await fetch("/api/voice/speak", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: confirmation }),
          });
          if (speakRes.ok) {
            const audioBlob = await speakRes.blob();
            const url = URL.createObjectURL(audioBlob);
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
            await audio.play().catch(() => {});
          }
        } catch {
          // Spoken confirmation is a nice-to-have — a TTS failure shouldn't
          // hide the track result that was already dispatched.
        }
      } catch (err) {
        setError({ type: "api", message: err instanceof Error ? err.message : "Something went wrong" });
      } finally {
        setIsBusy(false);
      }
    },
    [dispatch, sessionId, activeMessages, searchType],
  );

  const searchText = useCallback(
    (text: string) => {
      setError(null);
      const trimmed = text.trim();
      if (!trimmed) return;
      void runSearchPipeline(trimmed, false);
    },
    [runSearchPipeline],
  );

  const runPipeline = useCallback(
    async (clip: Blob) => {
      setIsBusy(true);
      try {
        const form = new FormData();
        form.append("audio", clip);
        const transcribeRes = await fetch("/api/voice/transcribe", { method: "POST", body: form });
        const transcribeData = await transcribeRes.json();
        if (!transcribeRes.ok) {
          setError({ type: "api", message: transcribeData.error ?? "Transcription failed" });
          setIsBusy(false);
          return;
        }

        const text: string = transcribeData.text ?? "";
        if (!text) {
          setError({ type: "no-speech" });
          setIsBusy(false);
          return;
        }

        await runSearchPipeline(text, true);
      } catch (err) {
        setError({ type: "api", message: err instanceof Error ? err.message : "Something went wrong" });
        setIsBusy(false);
      }
    },
    [runSearchPipeline],
  );

  const startRecording = useCallback(async () => {
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError({ type: "mic-denied" });
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError({ type: "mic-denied" });
      return;
    }

    const recorder = new MediaRecorder(stream, { mimeType: pickMimeType() });
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const clip = new Blob(chunksRef.current, { type: recorder.mimeType });
      void runPipeline(clip);
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  }, [runPipeline]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, []);

  return { isRecording, isBusy, error, startRecording, stopRecording, searchText };
}
