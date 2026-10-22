"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Event } from "@/lib/data";
import { getFavorites } from "@/lib/store";
import EventCard from "@/components/EventCard";
import { Heart } from "lucide-react";

export default function FavorisPage() {
  const [favs, setFavs] = useState<string[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = () => setFavs(getFavorites());
    load();
    setReady(true);
    window.addEventListener("lome-store-change", load);
    fetch("/api/events")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Impossible de charger les événements.");
        return result as Event[];
      })
      .then((events) => { if (active) setAllEvents(events); })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Impossible de charger les événements.");
      });
    return () => {
      active = false;
      window.removeEventListener("lome-store-change", load);
    };
  }, []);

  const events = useMemo(() => allEvents.filter((event) => favs.includes(event.id)), [allEvents, favs]);

  return (
    <div className="px-4 py-5 pb-28 lg:pb-10 max-w-6xl mx-auto">
      <h1 className="font-display font-bold text-3xl">
        Mes événements <span className="sunset-text">favoris</span>
      </h1>
      <p className="text-muted text-sm mt-1">
        {events.length} événement{events.length > 1 ? "s" : ""} sauvegardé
        {events.length > 1 ? "s" : ""}
      </p>
      {error && <p role="alert" className="mt-4 text-sm text-togored">{error}</p>}

      {ready && events.length === 0 ? (
        <div className="mt-10 text-center py-16 rounded-3xl bg-ink-2 border border-line/60">
          <Heart className="mx-auto h-12 w-12 text-muted" />
          <p className="mt-4 font-display font-bold text-xl">Aucun favori pour le moment</p>
          <p className="mt-1 text-muted text-sm">
            Touchez le cœur sur un événement pour le retrouver ici.
          </p>
          <Link
            href="/"
            className="inline-block mt-6 px-6 py-3 rounded-full font-display font-bold text-ink sunset-gradient"
          >
            Découvrir les événements
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
          {events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}
