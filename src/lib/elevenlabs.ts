// ElevenLabs premade "Rachel" voice — used unless ELEVENLABS_VOICE_ID overrides it.
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

function requireApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ElevenLabs API key is not configured");
  return key;
}

export async function transcribeAudio(audio: Blob): Promise<string> {
  const apiKey = requireApiKey();
  const form = new FormData();
  form.append("model_id", "scribe_v2");
  form.append("file", audio, "clip.webm");

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`ElevenLabs transcription failed (${res.status})`);
  }

  const data = await res.json();
  return ((data.text as string) ?? "").trim();
}

export async function synthesizeSpeech(text: string): Promise<ArrayBuffer> {
  const apiKey = requireApiKey();
  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({ text, model_id: "eleven_flash_v2_5" }),
  });

  if (!res.ok) {
    throw new Error(`ElevenLabs speech synthesis failed (${res.status})`);
  }

  return res.arrayBuffer();
}
