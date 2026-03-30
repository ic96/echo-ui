export type Message = {
  role: "user" | "assistant";
  content: string;
};

export type ChatSession = {
  id: string;
  title: string;
  createdAt: Date;
  messages: Message[];
};

export type SessionAction =
  // Session management
  | { type: "newChat"; session: ChatSession }
  | { type: "deleteChat"; id: string }
  | { type: "selectChat"; id: string }
  // Message mutations (dispatched by useChat)
  | { type: "sendMessage"; sessionId: string; message: Message; newTitle?: string }
  | { type: "editAndResend"; sessionId: string; index: number; message: Message }
  | { type: "appendAssistant"; sessionId: string }
  | { type: "resetLastAssistant"; sessionId: string }
  | { type: "appendChunk"; sessionId: string; chunk: string }
  | { type: "setLastError"; sessionId: string; error: string }
  | { type: "appendError"; sessionId: string; error: string };
