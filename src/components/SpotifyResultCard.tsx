import { Card } from "@/components/ui/Card";
import type { SpotifyItem } from "@/types/voice";

// Generic counterpart to TrackCard for non-track search results (artist,
// album, playlist, show, episode, audiobook) — Spotify's embed widget is
// type-aware, so one iframe pattern covers all of them.

export function SpotifyResultCard({ item }: { item: SpotifyItem }) {
  return (
    <Card size="sm" className="w-72 sm:w-80 shrink-0 overflow-hidden py-0 px-3">
      <iframe
        title={`Spotify ${item.type}: ${item.name}`}
        src={`https://open.spotify.com/embed/${item.type}/${item.id}?utm_source=generator&theme=0`}
        width="100%"
        height={352}
        style={{ border: 0 }}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    </Card>
  );
}
