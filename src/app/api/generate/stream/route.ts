import { cookies } from "next/headers";
import { validatePrompt } from "@/lib/sanitize";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session_token")?.value;

  if (!sessionToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const validation = validatePrompt(body?.prompt);
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    // Replace the raw prompt with the sanitized version before forwarding.
    const sanitizedBody = { ...body, prompt: validation.value };

    const backendRes = await fetch("http://localhost:8080/generate/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.INTERNAL_SERVICE_SECRET}`,
        "X-User-Session": sessionToken,
      },
      body: JSON.stringify(sanitizedBody),
      cache: "no-store",
    });

    if (!backendRes.ok) {
      const text = await backendRes.text();
      let data: unknown;
      try { data = JSON.parse(text); } catch { data = { error: text || backendRes.statusText }; }
      return Response.json(data, { status: backendRes.status });
    }

    return new Response(backendRes.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
