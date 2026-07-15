// Simple keyword heuristic for routing typed chat input: if it looks like a
// song/artist/album/etc. search, send it to Spotify search instead of the
// general AI chat backend.
const SPOTIFY_KEYWORDS = [
  "play ",
  "spotify",
  "song",
  "songs",
  "track",
  "tracks",
  "album",
  "albums",
  "artist",
  "artists",
  "playlist",
  "playlists",
  "podcast",
  "podcasts",
  "episode",
  "audiobook",
  "listen to",
  "find me",
  "search for",
  "who sings",
];

export function isSpotifyQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return SPOTIFY_KEYWORDS.some((keyword) => lower.includes(keyword));
}
