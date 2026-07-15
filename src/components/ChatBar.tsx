"use client";
import { useCallback, memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Mic, Square } from "lucide-react";
import { Animated } from "@/components/Animated";
import { Textarea } from "@/components/ui/Textarea";
import { Card, CardContent } from "@/components/ui/Card";
import { MAX_PROMPT_LENGTH, PROMPT_WARN_THRESHOLD } from "@/lib/sanitize";
import type { SpotifySearchType, VoiceError } from "@/types/voice";

const SEARCH_TYPE_LABELS: Record<SpotifySearchType, string> = {
  track: "Song",
  artist: "Artist",
  album: "Album",
  playlist: "Playlist",
  show: "Podcast",
  episode: "Episode",
  audiobook: "Audiobook",
};

const SEARCH_TYPE_PLACEHOLDER: Record<SpotifySearchType, string> = {
  track: "Search for any song...",
  artist: "Search for any artist...",
  album: "Search for any album...",
  playlist: "Search for any playlist...",
  show: "Search for any podcast...",
  episode: "Search for any episode...",
  audiobook: "Search for any audiobook...",
};

function voiceErrorMessage(error: VoiceError): string {
  switch (error.type) {
    case "no-speech":
      return "Didn't catch that — try again?";
    case "no-match":
      return "No matches found on Spotify.";
    case "mic-denied":
      return "Microphone access is required to search by voice.";
    case "api":
      return error.message;
  }
}

// ─── LimitRing ────────────────────────────────────────────────────────────────
// SVG ring that fills proportionally to the prompt length and changes color
// as the user approaches / exceeds the character limit.

const RING_R = 10;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

function LimitRing({ length }: { length: number }) {
  const ratio = Math.min(length / MAX_PROMPT_LENGTH, 1);
  const offset = RING_CIRCUMFERENCE * (1 - ratio);

  const isOver = length > MAX_PROMPT_LENGTH;
  const isWarn = length >= PROMPT_WARN_THRESHOLD;

  const color = isOver
    ? "var(--color-destructive, #ef4444)"
    : isWarn
      ? "#f59e0b"
      : "var(--color-primary)";

  const showNumeric = isWarn || isOver;
  const remaining = MAX_PROMPT_LENGTH - length;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <svg
        width={24}
        height={24}
        viewBox="0 0 24 24"
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={12}
          cy={12}
          r={RING_R}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          className="text-muted-foreground/20"
        />
        {/* Fill */}
        <circle
          cx={12}
          cy={12}
          r={RING_R}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.15s ease, stroke 0.2s ease" }}
        />
      </svg>

      {showNumeric && (
        <span
          className="absolute text-[8px] font-semibold tabular-nums leading-none"
          style={{ color, transition: "color 0.2s ease" }}
        >
          {isOver ? `+${Math.abs(remaining)}` : remaining}
        </span>
      )}
    </div>
  );
}

// ─── ChatBar ──────────────────────────────────────────────────────────────────

type ChatBarProps = {
  prompt: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onAbort: () => void;
  isRecording: boolean;
  isVoiceBusy: boolean;
  voiceError: VoiceError | null;
  onMicClick: () => void;
  searchType: SpotifySearchType;
  onSearchTypeChange: (type: SpotifySearchType) => void;
};

export const ChatBar = memo(function ChatBar({
  prompt,
  loading,
  onChange,
  onSubmit,
  onAbort,
  isRecording,
  isVoiceBusy,
  voiceError,
  onMicClick,
  searchType,
  onSearchTypeChange,
}: ChatBarProps) {
  const isOver = prompt.length > MAX_PROMPT_LENGTH;
  const canSubmit = prompt.length > 0 && !isOver;

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isOver) onSubmit();
    }
  }, [onSubmit, isOver]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  return (
    <Animated preset="fadeUp" delay={0.15} className="shrink-0 p-4">
      <Card className="w-[90%] mx-auto max-h-[60vh] flex flex-col">
        <CardContent className="overflow-y-auto">
          <div className="flex items-center gap-1.5 pb-3 text-xs text-muted-foreground">
            <span>Search:</span>
            <select
              value={searchType}
              onChange={(e) => onSearchTypeChange(e.target.value as SpotifySearchType)}
              aria-label="Voice search type"
              className="rounded-md border border-border bg-transparent px-1.5 py-0.5 text-xs text-foreground focus-visible:ring-1 focus-visible:ring-ring"
            >
              {Object.entries(SEARCH_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Textarea
              value={prompt}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={SEARCH_TYPE_PLACEHOLDER[searchType]}
              rows={1}
              className="min-h-9 resize-none pr-14 pl-14 focus-visible:ring-1"
              aria-label="Chat message input"
            />

            {/* Bottom-left: voice song search */}
            <button
              type="button"
              onClick={onMicClick}
              disabled={isVoiceBusy || (loading && !isRecording)}
              aria-label={isRecording ? "Stop recording" : "Search a song by voice"}
              className={`absolute top-1/2 left-2 -translate-y-1/2 size-7 rounded-lg inline-flex items-center justify-center transition-colors disabled:opacity-50 ${
                isRecording
                  ? "bg-destructive/10 text-destructive"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {isVoiceBusy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : isRecording ? (
                <Square className="size-3.5" />
              ) : (
                <Mic className="size-3.5" />
              )}
            </button>

            {/* Bottom-right action cluster: ring + send/stop button */}
            <div className="absolute top-1/2 right-2 -translate-y-1/2 flex items-center gap-1.5">
              {/* Character limit ring — only visible when typing */}
              <AnimatePresence>
                {prompt.length > 0 && !loading && (
                  <motion.div
                    key="ring"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                  >
                    <LimitRing length={prompt.length} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Stop / Send button */}
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.button
                    key="stop"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    onClick={onAbort}
                    aria-label="Stop generation"
                    className="size-9 rounded-lg bg-primary text-primary-foreground inline-flex items-center justify-center"
                  >
                    <span className="size-3.5 rounded-sm bg-current" />
                  </motion.button>
                ) : canSubmit ? (
                  <motion.button
                    key="send"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    onClick={onSubmit}
                    aria-label="Send message"
                    className="size-9 rounded-lg bg-primary text-primary-foreground inline-flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4">
                      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                    </svg>
                  </motion.button>
                ) : isOver ? (
                  <motion.div
                    key="over"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    aria-label="Message too long"
                    className="size-9 rounded-lg bg-destructive/10 text-destructive inline-flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4">
                      <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                    </svg>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          {/* Over-limit warning message */}
          <AnimatePresence>
            {isOver && (
              <motion.p
                key="over-msg"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="text-xs text-destructive mt-1.5 overflow-hidden"
              >
                Message exceeds the {MAX_PROMPT_LENGTH.toLocaleString()}-character limit. Please shorten it before sending.
              </motion.p>
            )}
          </AnimatePresence>

          {/* Voice search error */}
          <AnimatePresence>
            {voiceError && (
              <motion.p
                key="voice-error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="text-xs text-destructive mt-1.5 overflow-hidden"
              >
                {voiceErrorMessage(voiceError)}
              </motion.p>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </Animated>
  );
});
