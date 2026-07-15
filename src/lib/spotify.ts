import type { SpotifyArtist, SpotifyItem, SpotifySearchType, SpotifyTrack } from "@/types/voice";

// Client Credentials tokens are app-wide (no user context), so a single
// module-level cache is safe to share across requests in this process.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Spotify credentials are not configured");
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Spotify token exchange failed (${res.status})`);
  }

  const data = await res.json();
  // Refresh a minute early so a near-expiry token is never handed to a caller.
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.value;
}

export async function searchTracks(query: string, limit = 5): Promise<SpotifyTrack[]> {
  const token = await getAccessToken();
  const params = new URLSearchParams({ q: query, type: "track", limit: String(limit) });

  const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Spotify search failed (${res.status})`);
  }

  const data = await res.json();
  const items: unknown[] = data?.tracks?.items ?? [];

  return items.map((item) => {
    const track = item as {
      id: string;
      name: string;
      artists: { id: string; name: string }[];
      album: { id: string; images: { url: string }[] };
      preview_url: string | null;
      external_urls: { spotify: string };
    };
    return {
      id: track.id,
      name: track.name,
      artists: track.artists.map((a) => a.name),
      albumArt: track.album.images[0]?.url ?? null,
      previewUrl: track.preview_url,
      externalUrl: track.external_urls.spotify,
      albumId: track.album.id,
      artistId: track.artists[0]?.id ?? "",
    };
  });
}

// Recommendations/Related Artists are gone (see SpotifySearchType comment),
// so "search beyond songs" leans on multi-type search instead. Each Spotify
// object shape differs, hence the per-type field mapping below.
export async function searchByType(
  query: string,
  type: Exclude<SpotifySearchType, "track">,
  limit = 5,
): Promise<SpotifyItem[]> {
  const token = await getAccessToken();
  const params = new URLSearchParams({ q: query, type, limit: String(limit) });

  const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Spotify search failed (${res.status})`);
  }

  const data = await res.json();
  const items: unknown[] = data?.[`${type}s`]?.items ?? [];

  return items.filter(Boolean).map((item) => {
    const obj = item as {
      id: string;
      name: string;
      images?: { url: string }[];
      album?: { images: { url: string }[] };
      artists?: { name: string }[];
      genres?: string[];
      owner?: { display_name: string };
      publisher?: string;
      authors?: { name: string }[];
      show?: { name: string };
      external_urls: { spotify: string };
    };
    const image = obj.images?.[0]?.url ?? obj.album?.images?.[0]?.url ?? null;
    const subtitle =
      obj.artists?.map((a) => a.name).join(", ") ??
      (type === "artist" ? (obj.genres?.join(", ") || "Artist") : undefined) ??
      (obj.owner && `By ${obj.owner.display_name}`) ??
      obj.publisher ??
      obj.authors?.map((a) => a.name).join(", ") ??
      obj.show?.name ??
      "";

    return {
      id: obj.id,
      type,
      name: obj.name,
      subtitle,
      image,
      externalUrl: obj.external_urls.spotify,
    };
  });
}

export async function getArtist(artistId: string): Promise<SpotifyArtist> {
  const token = await getAccessToken();
  const res = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Spotify artist lookup failed (${res.status})`);
  }

  const artist = await res.json();
  return {
    id: artist.id,
    name: artist.name,
    image: artist.images?.[0]?.url ?? null,
    genres: artist.genres ?? [],
    followers: artist.followers?.total ?? null,
    popularity: artist.popularity ?? null,
    externalUrl: artist.external_urls.spotify,
  };
}
