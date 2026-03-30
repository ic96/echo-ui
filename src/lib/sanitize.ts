/**
 * Input sanitization utilities for chat messages.
 *
 * Defence-in-depth strategy:
 *  1. Strip null bytes and non-printable control characters that can confuse
 *     parsers (C0 range except tab, LF, CR).
 *  2. Normalize newlines to \n so storage/display is consistent.
 *  3. Enforce a maximum length to prevent abuse of the backend.
 *
 * React already HTML-escapes text interpolation, so stripping tags is NOT
 * done here to avoid silently altering user content (e.g. `<b>hi</b>` as
 * literal text). The protection against HTML injection lives in the rendering
 * layer — never use dangerouslySetInnerHTML with unsanitized content.
 */

export const MAX_PROMPT_LENGTH = 10_000;
// Warn the user when they're within this many chars of the limit.
export const PROMPT_WARN_THRESHOLD = 9_000;

/**
 * Sanitizes a raw string from user input.
 * Safe to call on both client and server (no DOM dependency).
 */
export function sanitizeInput(raw: string): string {
  if (typeof raw !== "string") return "";

  return (
    raw
      // Remove null bytes — can trick some parsers into truncating strings.
      .replace(/\0/g, "")
      // Remove other non-printable C0 control chars except HT(\x09), LF(\x0A), CR(\x0D).
      // eslint-disable-next-line no-control-regex
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      // Normalize line endings to \n.
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      // Enforce max length.
      .slice(0, MAX_PROMPT_LENGTH)
  );
}

export type ValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

/**
 * Sanitizes and validates a chat prompt.
 * Returns the cleaned value on success or an error message on failure.
 */
export function validatePrompt(raw: unknown): ValidationResult {
  if (typeof raw !== "string") {
    return { ok: false, error: "Prompt must be a string." };
  }

  const value = sanitizeInput(raw);

  if (!value.trim()) {
    return { ok: false, error: "Prompt cannot be empty." };
  }

  if (raw.length > MAX_PROMPT_LENGTH) {
    return {
      ok: false,
      error: `Prompt exceeds the ${MAX_PROMPT_LENGTH.toLocaleString()}-character limit.`,
    };
  }

  return { ok: true, value };
}
