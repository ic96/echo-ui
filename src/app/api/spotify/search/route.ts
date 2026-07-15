import { cookies } from "next/headers";
import { searchByType, searchTracks } from "@/lib/spotify";
import type { SpotifySearchType } from "@/types/voice";

const SEARCH_TYPES: SpotifySearchType[] = [
  "track",
  "artist",
  "album",
  "playlist",
  "show",
  "episode",
  "audiobook",
];

export async function GET(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get("session_token")?.value) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim();
  if (!query) {
    return Response.json({ error: "Missing search query" }, { status: 400 });
  }

  const type = (params.get("type") ?? "track") as SpotifySearchType;
  if (!SEARCH_TYPES.includes(type)) {
    return Response.json({ error: "Invalid search type" }, { status: 400 });
  }

  try {
    if (type === "track") {
      const tracks = await searchTracks(query, 5);
      return Response.json({ tracks });
    }
    const items = await searchByType(query, type, 5);
    return Response.json({ items });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 502 });
  }
}
