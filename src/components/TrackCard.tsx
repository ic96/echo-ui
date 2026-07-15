"use client";
import { useState } from "react";
import { Disc3, Loader2, Sparkles, User } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { SpotifyArtist, SpotifyTrack } from "@/types/voice";

// Uses Spotify's embed widget for playback — the Web API no longer returns
// preview_url for newer apps.

type ExpandedPanel = "album" | "artist" | null;

type TrackCardProps = {
  track: SpotifyTrack;
  onFindSimilar?: (track: SpotifyTrack) => void;
};

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function TrackCard({ track, onFindSimilar }: TrackCardProps) {
  const [expanded, setExpanded] = useState<ExpandedPanel>(null);
  const [artist, setArtist] = useState<SpotifyArtist | null>(null);
  const [artistLoading, setArtistLoading] = useState(false);
  const [artistError, setArtistError] = useState<string | null>(null);

  const toggleAlbum = () => setExpanded((cur) => (cur === "album" ? null : "album"));

  const toggleArtist = () => {
    setExpanded((cur) => (cur === "artist" ? null : "artist"));
    if (!artist && !artistLoading) {
      setArtistLoading(true);
      setArtistError(null);
      fetch(`/api/spotify/artist?id=${track.artistId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.artist) setArtist(data.artist);
          else setArtistError(data.error ?? "Couldn't load artist info");
        })
        .catch(() => setArtistError("Couldn't load artist info"))
        .finally(() => setArtistLoading(false));
    }
  };

  return (
    <Card size="sm" className="w-72 sm:w-80 shrink-0 overflow-hidden py-0 px-3">
      <iframe
        title={`Spotify player: ${track.name} by ${track.artists.join(", ")}`}
        src={`https://open.spotify.com/embed/track/${track.id}?utm_source=generator&theme=0`}
        width="100%"
        height={352}
        style={{ border: 0 }}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />

      <div className="flex items-center gap-1 py-2">
        <button
          type="button"
          onClick={toggleAlbum}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
            expanded === "album"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Disc3 className="size-3.5" />
          Album
        </button>
        <button
          type="button"
          onClick={toggleArtist}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
            expanded === "artist"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <User className="size-3.5" />
          Artist
        </button>
        {onFindSimilar && (
          <button
            type="button"
            onClick={() => onFindSimilar(track)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Sparkles className="size-3.5" />
            More like this
          </button>
        )}
      </div>

      {expanded === "album" && (
        <div className="pb-3">
          <iframe
            title={`Spotify album for ${track.name}`}
            src={`https://open.spotify.com/embed/album/${track.albumId}?utm_source=generator&theme=0`}
            width="100%"
            height={352}
            style={{ border: 0 }}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        </div>
      )}

      {expanded === "artist" && (
        <div className="pb-3 text-xs text-muted-foreground">
          {artistLoading ? (
            <div className="flex items-center gap-1.5 py-2">
              <Loader2 className="size-3.5 animate-spin" />
              Loading artist info…
            </div>
          ) : artistError ? (
            <p className="text-destructive py-2">{artistError}</p>
          ) : artist ? (
            <div className="flex items-center gap-3 py-1">
              {artist.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={artist.image}
                  alt={artist.name}
                  className="size-12 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="size-12 rounded-full bg-muted shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{artist.name}</p>
                {artist.genres.length > 0 && (
                  <p className="truncate">{artist.genres.join(", ")}</p>
                )}
                {artist.followers !== null || artist.popularity !== null ? (
                  <p>
                    {artist.followers !== null && `${formatFollowers(artist.followers)} followers`}
                    {artist.followers !== null && artist.popularity !== null && " · "}
                    {artist.popularity !== null && `${artist.popularity}% popularity`}
                  </p>
                ) : artist.genres.length === 0 ? (
                  <p>No additional details available</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
