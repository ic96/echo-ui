"use client";
import { memo } from "react";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/Sidebar";
import { Button } from "@/components/ui/Button";
import type { ChatSession as Chat } from "@/types/chat";

export type { Chat };

type AppSidebarProps = {
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
};

export const AppSidebar = memo(function AppSidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
}: AppSidebarProps) {
  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold text-foreground">OpenChat</span>
          <SidebarTrigger />
        </div>
        <Button onClick={onNewChat} className="w-full mt-2 gap-2">
          <Plus className="size-4" />
          New Chat
        </Button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Chats</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {chats.length === 0 && (
                <p className="px-2 text-sm text-muted-foreground">No chats yet.</p>
              )}
              {chats.map((chat) => (
                <SidebarMenuItem key={chat.id}>
                  <SidebarMenuButton
                    isActive={chat.id === activeChatId}
                    onClick={() => onSelectChat(chat.id)}
                  >
                    <MessageSquare className="size-4 shrink-0" />
                    <span className="truncate">{chat.title}</span>
                  </SidebarMenuButton>
                  <SidebarMenuAction
                    onClick={() => onDeleteChat(chat.id)}
                    className="text-muted-foreground hover:text-destructive"
                    showOnHover
                  >
                    <Trash2 className="size-3.5" />
                  </SidebarMenuAction>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <p className="text-xs text-muted-foreground">Powered by OpenRouter</p>
      </SidebarFooter>
    </Sidebar>
  );
});
