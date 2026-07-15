import { cookies } from "next/headers";
import { synthesizeSpeech } from "@/lib/elevenlabs";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get("session_token")?.value) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) {
      return Response.json({ error: "Missing text" }, { status: 400 });
    }

    const audio = await synthesizeSpeech(text);
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 });
  }
}
