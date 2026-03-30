"use client";
import {
  useState,
  useCallback,
  useRef,
  useEffect,
  memo,
  forwardRef,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Pencil } from "lucide-react";
import { Virtuoso, type Components, type VirtuosoHandle } from "react-virtuoso";
import { Animated } from "@/components/Animated";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import type { Message } from "@/types/chat";

// ─── MessageBubble ────────────────────────────────────────────────────────────
// Memoized so it only re-renders when its own msg content changes.
// During SSE streaming only the last assistant bubble re-renders.

type MessageBubbleProps = {
  msg: Message;
  index: number;
  isEditing: boolean;
  editText: string;
  onEditTextChange: (value: string) => void;
  onEditStart: (index: number, content: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
};

const MessageBubble = memo(function MessageBubble({
  msg,
  index,
  isEditing,
  editText,
  onEditTextChange,
  onEditStart,
  onEditSave,
  onEditCancel,
}: MessageBubbleProps) {
  return (
    <Animated
      preset={msg.role === "user" ? "fadeLeft" : "fadeRight"}
      duration={0.3}
      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
    >
      {msg.role === "user" && isEditing ? (
        <div className="w-full max-w-[90%] flex flex-col gap-2">
          <Textarea
            value={editText}
            onChange={(e) => onEditTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onEditSave();
              }
              if (e.key === "Escape") onEditCancel();
            }}
            className="resize-none focus-visible:ring-1"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={onEditCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={onEditSave}>
              Send
            </Button>
          </div>
        </div>
      ) : msg.role === "user" ? (
        <div className="group flex items-center gap-2 max-w-full min-w-0">
          <button
            onClick={() => onEditStart(index, msg.content)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0"
          >
            <Pencil className="size-3.5" />
          </button>
          <div className="rounded-xl px-4 py-2 text-sm leading-7 whitespace-pre-wrap bg-primary text-primary-foreground min-w-0">
            {msg.content}
          </div>
        </div>
      ) : (
        <p className="text-sm leading-7 whitespace-pre-wrap text-foreground">
          {msg.content}
        </p>
      )}
    </Animated>
  );
});

// ─── Virtuoso custom components ───────────────────────────────────────────────

const virtuosoComponents: Components<Message> = {
  // Centers and constrains the list width, matching the old max-w-4xl container
  List: forwardRef(function List({ children, style, ...props }, ref) {
    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        style={style}
        {...props}
        className="flex flex-col w-full max-w-4xl mx-auto pb-4"
      >
        {children}
      </div>
    );
  }),
  // Wraps each item with consistent vertical padding
  Item: function Item({ children, ...props }) {
    return (
      <div {...props} className="pt-3">
        {children}
      </div>
    );
  },
};

// ─── MessageList ──────────────────────────────────────────────────────────────

type MessageListProps = {
  messages: Message[];
  activeChatId: string;
  loading: boolean;
  onEditAndResend: (index: number, newContent: string) => void;
};

export const MessageList = memo(function MessageList({
  messages,
  activeChatId,
  loading,
  onEditAndResend,
}: MessageListProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [showScrollButton, setShowScrollButton] = useState(false);

  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const lastScrollTop = useRef(0);
  const isAtBottomRef = useRef(true);

  // Reset edit state when switching chats
  useEffect(() => {
    setEditingIndex(null);
    setEditText("");
  }, [activeChatId]);

  // When a user message is added, snap that item to the top so the assistant
  // response has room to appear below it.
  const messageCount = messages.length;
  useEffect(() => {
    if (messages[messages.length - 1]?.role !== "user") return;
    const id = setTimeout(() => {
      virtuosoRef.current?.scrollToIndex({
        index: messages.length - 1,
        align: "start",
        behavior: "smooth",
      });
    }, 50);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageCount]);

  // followOutput handles new-item scroll, but doesn't fire when an existing
  // item grows (streaming). This effect covers that case.
  const lastContent = messages[messages.length - 1]?.content;
  useEffect(() => {
    if (!loading || !isAtBottomRef.current) return;
    const raf = requestAnimationFrame(() => {
      scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
    });
    return () => cancelAnimationFrame(raf);
  }, [lastContent, loading]);

  // Track scroll direction to hide the button while scrolling down.
  // atBottomStateChange on Virtuoso handles showing/hiding at the bottom.
  const setScrollerRef = useCallback((ref: HTMLElement | Window | null) => {
    if (!(ref instanceof HTMLElement)) return;
    scrollerRef.current = ref;
    ref.addEventListener(
      "scroll",
      () => {
        const el = scrollerRef.current;
        if (!el) return;
        const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        const scrollingDown = el.scrollTop > lastScrollTop.current;
        lastScrollTop.current = el.scrollTop;
        setShowScrollButton(!scrollingDown && distFromBottom > 100);
      },
      { passive: true },
    );
  }, []);

  const scrollToBottom = useCallback(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  const handleEditStart = useCallback((index: number, content: string) => {
    setEditingIndex(index);
    setEditText(content);
  }, []);

  const handleEditCancel = useCallback(() => {
    setEditingIndex(null);
    setEditText("");
  }, []);

  const handleEditSave = useCallback(() => {
    if (editingIndex === null) return;
    onEditAndResend(editingIndex, editText);
    setEditingIndex(null);
    setEditText("");
  }, [editingIndex, editText, onEditAndResend]);

  const handleEditTextChange = useCallback((value: string) => {
    setEditText(value);
  }, []);

  // Not memoized — Virtuoso needs a fresh reference each render so it
  // re-calls itemContent for visible items when message content changes
  // (e.g. each SSE chunk). MessageBubble's memo still prevents unnecessary
  // DOM updates for messages whose content hasn't changed.
  const renderItem = (index: number, msg: Message) => (
    <MessageBubble
      msg={msg}
      index={index}
      isEditing={editingIndex === index}
      editText={editText}
      onEditTextChange={handleEditTextChange}
      onEditStart={handleEditStart}
      onEditSave={handleEditSave}
      onEditCancel={handleEditCancel}
    />
  );

  const renderFooter = () =>
    loading && messages[messages.length - 1]?.role !== "assistant" ? (
      <div className="w-full max-w-4xl mx-auto pt-3 px-4">
        <p className="text-sm text-muted-foreground animate-pulse">Thinking…</p>
      </div>
    ) : null;

  return (
    <>
      <Virtuoso
        ref={virtuosoRef}
        className="flex-1 px-4 overflow-x-hidden"
        data={messages}
        scrollerRef={setScrollerRef}
        itemContent={renderItem}
        components={{ ...virtuosoComponents, Footer: renderFooter }}
        initialTopMostItemIndex={messages.length - 1}
        alignToBottom
        followOutput={(isAtBottom) => (isAtBottom ? "smooth" : false)}
        overscan={1000}
        atBottomStateChange={(atBottom) => {
          isAtBottomRef.current = atBottom;
          if (atBottom) setShowScrollButton(false);
        }}
      />

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            key="scroll-btn"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            onClick={scrollToBottom}
            className="absolute bottom-30 left-1/2 -translate-x-1/2 size-8 rounded-full bg-background border border-border text-foreground shadow-md inline-flex items-center justify-center hover:bg-accent"
          >
            <ChevronDown className="size-4 shrink-0" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
});
