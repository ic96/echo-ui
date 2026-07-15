import { cookies } from "next/headers";
import { transcribeAudio } from "@/lib/elevenlabs";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get("session_token")?.value) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await request.formData();
    const audio = form.get("audio");
    if (!(audio instanceof Blob)) {
      return Response.json({ error: "Missing audio clip" }, { status: 400 });
    }

    const text = await transcribeAudio(audio);
    return Response.json({ text });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 });
  }
}
