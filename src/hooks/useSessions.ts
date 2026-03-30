"use client";
import { useReducer, useId, useCallback, useMemo } from "react";
import type { ChatSession, SessionAction } from "@/types/chat";

function generateId() {
  return crypto.randomUUID();
}

function newSession(id: string): ChatSession {
  return { id, title: "New Chat", createdAt: new Date(0), messages: [] };
}

type State = {
  sessions: ChatSession[];
  activeChatId: string;
};

function sessionsReducer(state: State, action: SessionAction): State {
  switch (action.type) {
    case "newChat":
      return { sessions: [action.session, ...state.sessions], activeChatId: action.session.id };

    case "deleteChat": {
      const next = state.sessions.filter((s) => s.id !== action.id);
      if (next.length === 0) {
        const fresh = { ...newSession(generateId()), createdAt: new Date() };
        return { sessions: [fresh], activeChatId: fresh.id };
      }
      return {
        sessions: next,
        activeChatId: action.id === state.activeChatId ? next[0].id : state.activeChatId,
      };
    }

    case "selectChat":
      return { ...state, activeChatId: action.id };

    case "sendMessage":
      return {
        ...state,
        sessions: state.sessions.map((s) =>
          s.id === action.sessionId
            ? {
                ...s,
                title: action.newTitle ?? s.title,
                messages: [...s.messages, action.message],
              }
            : s,
        ),
      };

    case "editAndResend":
      return {
        ...state,
        sessions: state.sessions.map((s) =>
          s.id === action.sessionId
            ? { ...s, messages: [...s.messages.slice(0, action.index), action.message] }
            : s,
        ),
      };

    case "appendAssistant":
      return {
        ...state,
        sessions: state.sessions.map((s) =>
          s.id === action.sessionId
            ? { ...s, messages: [...s.messages, { role: "assistant", content: "" }] }
            : s,
        ),
      };

    case "resetLastAssistant":
      return {
        ...state,
        sessions: state.sessions.map((s) => {
          if (s.id !== action.sessionId) return s;
          const msgs = [...s.messages];
          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: "" };
          return { ...s, messages: msgs };
        }),
      };

    case "appendChunk":
      return {
        ...state,
        sessions: state.sessions.map((s) => {
          if (s.id !== action.sessionId) return s;
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          msgs[msgs.length - 1] = { ...last, content: last.content + action.chunk };
          return { ...s, messages: msgs };
        }),
      };

    case "setLastError":
      return {
        ...state,
        sessions: state.sessions.map((s) => {
          if (s.id !== action.sessionId) return s;
          const msgs = [...s.messages];
          msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: "Error: " + action.error };
          return { ...s, messages: msgs };
        }),
      };

    case "appendError":
      return {
        ...state,
        sessions: state.sessions.map((s) =>
          s.id === action.sessionId
            ? { ...s, messages: [...s.messages, { role: "assistant", content: "Error: " + action.error }] }
            : s,
        ),
      };

    default:
      return state;
  }
}

export function useSessions() {
  const initialId = useId();
  const [{ sessions, activeChatId }, dispatch] = useReducer(sessionsReducer, {
    sessions: [newSession(initialId)],
    activeChatId: initialId,
  });

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeChatId)!,
    [sessions, activeChatId],
  );
  const messages = activeSession?.messages ?? [];

  const handleNewChat = useCallback(() => {
    dispatch({
      type: "newChat",
      session: { ...newSession(generateId()), createdAt: new Date() },
    });
  }, []);

  const handleDeleteChat = useCallback((id: string) => {
    dispatch({ type: "deleteChat", id });
  }, []);

  const handleSelectChat = useCallback((id: string) => {
    dispatch({ type: "selectChat", id });
  }, []);

  return {
    sessions,
    dispatch,
    activeChatId,
    messages,
    handleNewChat,
    handleDeleteChat,
    handleSelectChat,
  };
}
