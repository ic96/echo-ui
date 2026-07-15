export type SpotifyTrack = {
  id: string;
  name: string;
  artists: string[];
  albumArt: string | null;
  previewUrl: string | null;
  externalUrl: string;
  albumId: string;
  artistId: string; // primary (first) artist
};

// Types beyond "track" — Recommendations/Related Artists/Audio Features are
// dead for new Spotify apps (deprecated Nov 2024), so "more like this" and
// artist detail features are built from what's still available: catalog
// lookups (tracks/artists/albums by ID) and multi-type search.
export type SpotifySearchType =
  | "track"
  | "artist"
  | "album"
  | "playlist"
  | "show"
  | "episode"
  | "audiobook";

export type SpotifyItem = {
  id: string;
  type: SpotifySearchType;
  name: string;
  subtitle: string;
  image: string | null;
  externalUrl: string;
};

export type SpotifyArtist = {
  id: string;
  name: string;
  image: string | null;
  genres: string[];
  followers: number | null;
  popularity: number | null;
  externalUrl: string;
};

export type VoiceStage =
  | "idle"
  | "recording"
  | "transcribing"
  | "searching"
  | "speaking"
  | "done";

export type VoiceError =
  | { type: "no-speech" }
  | { type: "no-match" }
  | { type: "mic-denied" }
  | { type: "api"; message: string };
