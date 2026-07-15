// Keyword heuristic: route to Spotify search instead of general chat.
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
  "find",
  "search",
  "who sings",
];

export function isSpotifyQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return SPOTIFY_KEYWORDS.some((keyword) => lower.includes(keyword));
}
