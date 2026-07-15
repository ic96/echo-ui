import { cookies } from "next/headers";
import { getArtist } from "@/lib/spotify";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get("session_token")?.value) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) {
    return Response.json({ error: "Missing artist id" }, { status: 400 });
  }

  try {
    const artist = await getArtist(id);
    return Response.json({ artist });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 });
  }
}
