"use client";
import { useState, useCallback, useEffect } from "react";
import { Animated } from "@/components/Animated";
import { AppSidebar } from "@/components/AppSidebar";
import { ChatBar } from "@/components/ChatBar";
import { MessageList } from "@/components/MessageList";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/Sidebar";
import { useChat } from "@/hooks/useChat";
import { useSessions } from "@/hooks/useSessions";
import { useVoiceSearch } from "@/hooks/useVoiceSearch";
import { isSpotifyQuery } from "@/lib/spotifyIntent";
import type { SpotifySearchType, SpotifyTrack } from "@/types/voice";

export default function Home() {
  const {
    sessions,
    dispatch,
    activeChatId,
    messages,
    handleNewChat,
    handleDeleteChat,
    handleSelectChat,
  } = useSessions();

  const [prompt, setPrompt] = useState("");
  const [searchType, setSearchType] = useState<SpotifySearchType>("track");

  const { loading, sendMessage, abort, editAndResend } = useChat({
    sessionId: activeChatId,
    activeMessages: messages,
    dispatch,
  });

  const {
    isRecording,
    isBusy: isVoiceBusy,
    error: voiceError,
    startRecording,
    stopRecording,
    searchText,
  } = useVoiceSearch({
    sessionId: activeChatId,
    activeMessages: messages,
    dispatch,
    searchType,
  });

  // Recommendations/Related Artists are dead for new Spotify apps, so "more
  // like this" is a DIY substitute: search Spotify for other tracks by the
  // same artist instead of a real recommendation engine.
  const handleFindSimilar = useCallback(
    async (track: SpotifyTrack) => {
      const res = await fetch(
        `/api/spotify/search?q=${encodeURIComponent(`artist:"${track.artists[0]}"`)}&type=track`,
      );
      const data = await res.json();
      if (!res.ok) {
        dispatch({ type: "appendError", sessionId: activeChatId, error: data.error ?? "Search failed" });
        return;
      }
      const tracks: SpotifyTrack[] = (data.tracks ?? []).filter(
        (t: SpotifyTrack) => t.id !== track.id,
      );
      if (tracks.length === 0) {
        dispatch({ type: "appendError", sessionId: activeChatId, error: "No other tracks found" });
        return;
      }
      dispatch({
        type: "appendTrackResult",
        sessionId: activeChatId,
        content: `More by ${track.artists[0]}`,
        tracks,
      });
    },
    [dispatch, activeChatId],
  );

  const handleSubmit = useCallback(() => {
    if (isSpotifyQuery(prompt)) {
      searchText(prompt);
    } else {
      sendMessage(prompt);
    }
    setPrompt("");
  }, [sendMessage, searchText, prompt]);

  const handleMicClick = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else if (!isVoiceBusy && !loading) {
      void startRecording();
    }
  }, [isRecording, isVoiceBusy, loading, startRecording, stopRecording]);

  // Cmd+K (or Ctrl+K) toggles voice search from anywhere on the page —
  // starts recording, and pressing it again stops it, same as the mic button.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        handleMicClick();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleMicClick]);

  return (
    <SidebarProvider className="relative">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-center bg-no-repeat opacity-10"
        style={{ backgroundImage: "url(/chat-bg.png)", backgroundSize: "130%" }}
      />

      <AppSidebar
        chats={sessions}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
      />

      <SidebarInset className="relative flex flex-col h-svh overflow-hidden bg-transparent">
        <Animated
          as="h1"
          preset="fadeDown"
          className="scroll-m-20 text-4xl font-extrabold tracking-tight text-center py-6 flex items-center justify-center gap-3 shrink-0"
        >
          <SidebarTrigger className="-ml-1" />
          Echo
        </Animated>

        <MessageList
          messages={messages}
          activeChatId={activeChatId}
          loading={loading}
          onEditAndResend={editAndResend}
          onFindSimilar={handleFindSimilar}
        />

        <ChatBar
          prompt={prompt}
          loading={loading}
          onChange={setPrompt}
          onSubmit={handleSubmit}
          onAbort={abort}
          isRecording={isRecording}
          isVoiceBusy={isVoiceBusy}
          voiceError={voiceError}
          onMicClick={handleMicClick}
          searchType={searchType}
          onSearchTypeChange={setSearchType}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}
