"use client";
import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useLayoutEffect,
  memo,
  forwardRef,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Pencil } from "lucide-react";
import { Virtuoso, type Components, type VirtuosoHandle } from "react-virtuoso";
import { Animated } from "@/components/Animated";
import { Button } from "@/components/ui/Button";
import { TrackCard } from "@/components/TrackCard";
import { SpotifyResultCard } from "@/components/SpotifyResultCard";
import { Textarea } from "@/components/ui/Textarea";
import type { Message } from "@/types/chat";
import type { SpotifyTrack } from "@/types/voice";

// ─── MessageBubble ────────────────────────────────────────────────────────────
// Memoized: only re-renders when its own msg content changes.

type MessageBubbleProps = {
  msg: Message;
  index: number;
  isEditing: boolean;
  editText: string;
  onEditTextChange: (value: string) => void;
  onEditStart: (index: number, content: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onFindSimilar: (track: SpotifyTrack) => void;
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
  onFindSimilar,
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
      ) : msg.tracks && msg.tracks.length > 0 ? (
        <div className="flex flex-col gap-1.5 w-full min-w-0">
          <p className="text-sm leading-7 whitespace-pre-wrap text-foreground max-w-[90%]">
            {msg.content}
          </p>
          <div className="flex items-start gap-4 overflow-x-auto pr-4 pb-1">
            {msg.tracks.map((track) => (
              <TrackCard key={track.id} track={track} onFindSimilar={onFindSimilar} />
            ))}
          </div>
        </div>
      ) : msg.results && msg.results.length > 0 ? (
        <div className="flex flex-col gap-1.5 w-full min-w-0">
          <p className="text-sm leading-7 whitespace-pre-wrap text-foreground max-w-[90%]">
            {msg.content}
          </p>
          <div className="flex items-start gap-4 overflow-x-auto pr-4 pb-1">
            {msg.results.map((item) => (
              <SpotifyResultCard key={item.id} item={item} />
            ))}
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

type SpacerItem = { role: "spacer" };
type ListItem = Message | SpacerItem;

const virtuosoComponents: Components<ListItem> = {
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
  onFindSimilar: (track: SpotifyTrack) => void;
};

export const MessageList = memo(function MessageList({
  messages,
  activeChatId,
  loading,
  onEditAndResend,
  onFindSimilar,
}: MessageListProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [showScrollButton, setShowScrollButton] = useState(false);

  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const lastScrollTop = useRef(0);
  const isAtBottomRef = useRef(true);
  // Whether to keep following the reply as it streams. Re-armed on send,
  // cleared if the user scrolls away.
  const autoFollowRef = useRef(true);
  // Whether history already fills/overflows the viewport, as of the last
  // scroll/layout measurement (tracked continuously, since by send time the
  // DOM already includes the new message).
  const historyFillsViewportRef = useRef(false);
  const [scrollerHeight, setScrollerHeight] = useState(600);
  const streamingItemRef = useRef<HTMLDivElement | null>(null);
  const [streamingHeight, setStreamingHeight] = useState(0);

  // Reset edit state when switching chats
  useEffect(() => {
    setEditingIndex(null);
    setEditText("");
  }, [activeChatId]);

  // On send, scroll down to reveal the new message. Short history: target
  // the spacer, pinning the message near the top with room for the reply.
  // Full/overflowing history: target the message itself for a slight nudge
  // instead of a jarring jump. Smooth so it scrolls rather than cuts away.
  const messageCount = messages.length;
  useEffect(() => {
    if (messages[messages.length - 1]?.role !== "user") return;
    autoFollowRef.current = true;
    const historyFillsViewport = historyFillsViewportRef.current;
    const raf = requestAnimationFrame(() => {
      virtuosoRef.current?.scrollToIndex({
        index: historyFillsViewport || !loading ? messageCount - 1 : messageCount,
        align: "end",
        behavior: "smooth",
      });
    });
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageCount, loading]);

  // Keeps the growing reply's bottom in view while streaming. Targets the
  // message directly, not scrollHeight, since that includes the spacer.
  const lastContent = messages[messages.length - 1]?.content;
  useEffect(() => {
    if (!loading || !autoFollowRef.current || !lastContent) return;
    const raf = requestAnimationFrame(() => {
      virtuosoRef.current?.scrollToIndex({
        index: messageCount - 1,
        align: "end",
        behavior: "auto",
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [lastContent, loading, messageCount]);

  // Re-measure the streaming reply after each chunk so the spacer below it
  // can shrink to match, keeping the two at roughly one viewport height.
  useLayoutEffect(() => {
    if (!loading) {
      setStreamingHeight(0);
      return;
    }
    setStreamingHeight(streamingItemRef.current?.offsetHeight ?? 0);
  }, [lastContent, loading]);

  // Hides the scroll button while scrolling down; atBottomStateChange
  // handles showing/hiding it at the bottom.
  const setScrollerRef = useCallback((ref: HTMLElement | Window | null) => {
    if (!(ref instanceof HTMLElement)) return;
    scrollerRef.current = ref;
    setScrollerHeight(ref.clientHeight);
    historyFillsViewportRef.current = ref.scrollHeight > ref.clientHeight;
    ref.addEventListener(
      "scroll",
      () => {
        const el = scrollerRef.current;
        if (!el) return;
        const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        const scrollingDown = el.scrollTop > lastScrollTop.current;
        lastScrollTop.current = el.scrollTop;
        const scrolledAway = !scrollingDown && distFromBottom > 100;
        setShowScrollButton(scrolledAway);
        if (scrolledAway) autoFollowRef.current = false;
        historyFillsViewportRef.current = el.scrollHeight > el.clientHeight;
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

  // Spacer stays until loading ends (not just first chunk) to avoid a
  // viewport jump when isThinking toggles off. Shrinks as the reply grows.
  const lastMsg = messages[messages.length - 1];
  const isThinking = loading && (lastMsg?.role !== "assistant" || lastMsg?.content === "");
  const listItems: ListItem[] = loading
    ? [...messages, { role: "spacer" }]
    : messages;
  const spacerHeight = Math.max(0, scrollerHeight - streamingHeight);

  // Not memoized so Virtuoso re-calls itemContent on content changes;
  // MessageBubble's own memo still skips unchanged DOM updates.
  const renderItem = (index: number, item: ListItem) => {
    if (item.role === "spacer") {
      return (
        <div style={{ height: spacerHeight }}>
          {isThinking && (
            <p className="text-sm text-muted-foreground animate-pulse px-4 pt-3">Thinking…</p>
          )}
        </div>
      );
    }
    const bubble = (
      <MessageBubble
        msg={item}
        index={index}
        isEditing={editingIndex === index}
        editText={editText}
        onEditTextChange={handleEditTextChange}
        onEditStart={handleEditStart}
        onEditSave={handleEditSave}
        onEditCancel={handleEditCancel}
        onFindSimilar={onFindSimilar}
      />
    );
    // Wrap only the streaming reply so its height can be measured.
    return loading && index === messages.length - 1 ? (
      <div ref={streamingItemRef}>{bubble}</div>
    ) : (
      bubble
    );
  };

  return (
    <>
      <Virtuoso
        ref={virtuosoRef}
        className="chat-scroll flex-1 px-4 overflow-x-hidden"
        data={listItems}
        scrollerRef={setScrollerRef}
        itemContent={renderItem}
        components={virtuosoComponents}
        initialTopMostItemIndex={messages.length - 1}
        alignToBottom
        overscan={1000}
        atBottomStateChange={(atBottom) => {
          isAtBottomRef.current = atBottom;
          if (atBottom) {
            setShowScrollButton(false);
            autoFollowRef.current = true;
          }
          const el = scrollerRef.current;
          if (el) historyFillsViewportRef.current = el.scrollHeight > el.clientHeight;
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
