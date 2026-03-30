"use client";
import { useState, useCallback } from "react";
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

  const { loading, sendMessage, abort, editAndResend } = useChat({
    sessionId: activeChatId,
    activeMessages: messages,
    dispatch,
  });

  const handleSubmit = useCallback(() => {
    sendMessage(prompt);
    setPrompt("");
  }, [sendMessage, prompt]);

  return (
    <SidebarProvider>
      <AppSidebar
        chats={sessions}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
      />

      <SidebarInset className="relative flex flex-col h-svh overflow-hidden bg-muted">
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
        />

        <ChatBar
          prompt={prompt}
          loading={loading}
          onChange={setPrompt}
          onSubmit={handleSubmit}
          onAbort={abort}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}
