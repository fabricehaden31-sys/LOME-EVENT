"use client";

import Link from "next/link";
import type { Event } from "@/lib/data";
import { getOrganizer, minPrice } from "@/lib/data";
import { formatDateShortFR, formatFCFA } from "@/lib/utils";
import { toggleFavorite, getFavorites } from "@/lib/store";
import { Heart } from "lucide-react";
import { useSyncExternalStore } from "react";

function subscribeFavorites(onChange: () => void) {
  window.addEventListener("lome-store-change", onChange);
  return () => window.removeEventListener("lome-store-change", onChange);
}

const EVENT_IMAGES: Record<string, string> = {
  concerts: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=900&q=82",
  soirees: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=900&q=82",
  sport: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=900&q=82",
  business: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=82",
  formations: "https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=900&q=82",
  culture: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=900&q=82",
  festivals: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=900&q=82",
  famille: "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=900&q=82",
  networking: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=900&q=82",
};

export default function EventCard({ event }: { event: Event }) {
  const organizer = event.organizerName
    ? { ...getOrganizer(event.organizerId), name: event.organizerName }
    : getOrganizer(event.organizerId);
  const price = minPrice(event);
  const fav = useSyncExternalStore(
    subscribeFavorites,
    () => getFavorites().includes(event.id),
    () => false
  );

  const onToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(event.id);
  };

  return (
    <Link href={`/evenements/${event.id}`} className="group block">
      <article className="relative overflow-hidden rounded-sm border border-line bg-ink-2 transition duration-300 group-hover:-translate-y-1 group-hover:border-togogreen/60">
        {/* Poster */}
        <div
          className="poster relative flex aspect-[4/5] flex-col justify-between bg-cover bg-center p-3"
          role="img"
          aria-label={`Affiche de ${event.title}, à ${event.venue}`}
          style={
            {
              "--poster-a": event.poster[0],
              "--poster-b": event.poster[1],
              "--poster-c": event.poster[2],
              backgroundImage: `linear-gradient(180deg, rgba(19, 31, 25, 0.04) 0%, rgba(19, 31, 25, 0.08) 38%, rgba(19, 31, 25, 0.82) 100%), url("${event.posterUrl ?? EVENT_IMAGES[event.category] ?? EVENT_IMAGES.concerts}")`,
            } as React.CSSProperties
          }
        >
          <div className="flex items-start justify-between">
            <button
              onClick={onToggle}
              aria-label={fav ? "Retirer des favoris" : "Ajouter aux favoris"}
              aria-pressed={fav}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-togored shadow transition-transform hover:scale-105"
            >
              <Heart className={`h-5 w-5 ${fav ? "fill-current" : "fill-none"}`} strokeWidth={2.2} />
            </button>
          </div>
          <div>
            <p className="font-display text-3xl leading-tight text-white drop-shadow-md">
              {event.title}
            </p>
            <p className="text-white/85 text-xs mt-1 drop-shadow">{event.venue}</p>
          </div>
        </div>

        {/* Meta */}
        <div className="p-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-togogreen">
              {formatDateShortFR(event.date)} · {event.time}
            </p>
            <p className="text-muted text-xs truncate mt-0.5">
              {organizer?.name ?? ""}
            </p>
          </div>
          <p className="shrink-0 text-sm font-bold text-cream bg-ink-3 border border-line/60 rounded-full px-2.5 py-1">
            {price === 0 ? "Gratuit" : formatFCFA(price)}
          </p>
        </div>
      </article>
    </Link>
  );
}
