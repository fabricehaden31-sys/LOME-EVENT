"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CATEGORIES, getOrganizer } from "@/lib/data";
import type { Event } from "@/lib/data";
import { getIcon } from "@/lib/icons";
import { formatFCFA } from "@/lib/utils";
import EventCard from "@/components/EventCard";
import { Search } from "lucide-react";

const WEEKDAYS: Record<string, number> = {
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
  dimanche: 0,
};

const PRICE_FILTERS = [
  { id: "gratuit", label: "Gratuit" },
  { id: "1000-5000", label: "1 000 – 5 000 FCFA" },
  { id: "5000-10000", label: "5 000 – 10 000 FCFA" },
  { id: "10000+", label: "10 000 FCFA+" },
];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function dateInFilter(date: string, filter: string, custom: string): boolean {
  const d = new Date(`${date}T12:00:00`);
  const today = todayStr();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(
    tomorrow.getMonth() + 1
  ).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

  switch (filter) {
    case "today":
      return date === today;
    case "tomorrow":
      return date === tomorrowStr;
    case "weekend": {
      const day = d.getDay();
      return day === 5 || day === 6 || day === 0;
    }
    case "week": {
      const now = new Date();
      const limit = new Date(now);
      limit.setDate(limit.getDate() + 7);
      return d >= now && d <= limit;
    }
    case "custom":
      return custom ? date === custom : true;
    default:
      return true;
  }
}

function priceMatch(e: Event, filter: string): boolean {
  const min = Math.min(...e.tiers.map((t) => t.price));
  switch (filter) {
    case "gratuit":
      return min === 0;
    case "1000-5000":
      return min > 0 && min <= 5000;
    case "5000-10000":
      return min > 5000 && min <= 10000;
    case "10000+":
      return min > 10000;
    default:
      return true;
  }
}

function SearchPageInner() {
  const params = useSearchParams();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [dateFilter, setDateFilter] = useState(params.get("date") ?? "");
  const [customDate, setCustomDate] = useState("");
  const [cat, setCat] = useState(params.get("cat") ?? "");
  const [prix, setPrix] = useState(params.get("prix") ?? "");
  const [lieu, setLieu] = useState(params.get("lieu") ?? "");
  const [input, setInput] = useState(params.get("q") ?? "");
  const [events, setEvents] = useState<Event[]>([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/events")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Impossible de charger les événements.");
        return result as Event[];
      })
      .then((result) => {
        if (active) setEvents(result);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Impossible de charger les événements.");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setQ(params.get("q") ?? "");
    setInput(params.get("q") ?? "");
    setCat(params.get("cat") ?? "");
    setPrix(params.get("prix") ?? "");
    setDateFilter(params.get("date") ?? "");
    setLieu(params.get("lieu") ?? "");
  }, [params]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    const weekday = Object.entries(WEEKDAYS).find(([name]) =>
      query.includes(name)
    )?.[1];

    return events.filter((e) => {
      if (weekday !== undefined) {
        if (new Date(`${e.date}T12:00:00`).getDay() !== weekday) return false;
      } else if (query) {
        const org = e.organizerName
          ? { ...getOrganizer(e.organizerId), name: e.organizerName }
          : getOrganizer(e.organizerId);
        const catLabel =
          CATEGORIES.find((c) => c.id === e.category)?.label ?? "";
        const hay = `${e.title} ${e.venue} ${e.address} ${e.district} ${catLabel} ${org.name} ${e.description}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      if (cat && e.category !== cat) return false;
      if (prix && !priceMatch(e, prix)) return false;
      if (!dateInFilter(e.date, dateFilter, customDate)) return false;
      if (lieu) {
        const l = lieu.trim().toLowerCase();
        if (l && !`${e.district} ${e.venue} ${e.address}`.toLowerCase().includes(l))
          return false;
      }
      return true;
    }).sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  }, [events, q, cat, prix, dateFilter, customDate, lieu]);

  return (
    <div className="mx-auto max-w-6xl px-4">
      <h1 className="mt-6 flex items-center gap-2 font-display font-bold text-3xl sm:text-4xl">
        <Search className="h-6 w-6 text-amber" />
        Recherche
      </h1>
      <p className="mt-1 text-cream/60 text-sm">
        Essayez « concert », « conférence », « événement samedi », « événement à
        Agoè » ou « festival ».
      </p>
      {loadError && <p role="alert" className="mt-4 text-sm text-togored">{loadError}</p>}

      {/* Search bar */}
      <form
        className="mt-5 flex items-center rounded-2xl bg-ink-2 border border-line/70 focus-within:border-amber overflow-hidden"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(input);
        }}
      >
        <span className="pl-4 text-lg text-muted">
          <Search className="h-4 w-4" />
        </span>
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Rechercher un événement…"
          className="w-full bg-transparent px-3 py-3.5 text-cream placeholder:text-muted focus:outline-none"
        />
        <button
          type="submit"
          className="sunset-gradient shrink-0 px-5 py-3.5 font-display font-bold text-white"
        >
          Rechercher
        </button>
      </form>

      {/* Filters */}
      <div className="mt-5 space-y-3">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          <FilterChip active={dateFilter === ""} onClick={() => setDateFilter("")} label="Toutes les dates" />
          {[
            ["today", "Aujourd'hui"],
            ["tomorrow", "Demain"],
            ["weekend", "Ce week-end"],
            ["week", "Cette semaine"],
            ["custom", "Choisir une date"],
          ].map(([id, label]) => (
            <FilterChip
              key={id}
              active={dateFilter === id}
              onClick={() => setDateFilter(id)}
              label={label}
            />
          ))}
        </div>

        {dateFilter === "custom" && (
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="rounded-xl bg-ink-2 border border-line/70 px-3 py-2 text-cream focus:border-amber focus:outline-none"
          />
        )}

        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          <FilterChip active={cat === ""} onClick={() => setCat("")} label="Toutes catégories" />
          {CATEGORIES.map((c) => {
            const Icon = getIcon(c.emoji);
            return (
              <FilterChip
                key={c.id}
                active={cat === c.id}
                onClick={() => setCat(cat === c.id ? "" : c.id)}
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    <span>{c.label}</span>
                  </span>
                }
              />
            );
          })}
        </div>

        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          <FilterChip active={prix === ""} onClick={() => setPrix("")} label="Tous les prix" />
          {PRICE_FILTERS.map((p) => (
            <FilterChip
              key={p.id}
              active={prix === p.id}
              onClick={() => setPrix(prix === p.id ? "" : p.id)}
              label={p.label}
            />
          ))}
        </div>

        <div className="flex gap-2 max-w-md">
          <input
            type="text"
            value={lieu}
            onChange={(e) => setLieu(e.target.value)}
            placeholder="Lieu : Agoè, Bè, Centre-ville…"
            className="w-full rounded-xl bg-ink-2 border border-line/70 px-3 py-2.5 text-cream placeholder:text-muted focus:border-amber focus:outline-none"
          />
        </div>
      </div>

      {/* Results */}
      <p className="mt-6 text-sm text-cream/60">
        <strong className="text-cream">{results.length}</strong> événement
        {results.length > 1 ? "s" : ""} trouvé{results.length > 1 ? "s" : ""}
        {q && (
          <>
            {" "}pour « <strong className="text-amber">{q}</strong> »
          </>
        )}
      </p>

      {results.length === 0 ? (
        <div className="mt-10 text-center py-16 rounded-3xl border border-dashed border-line/60">
          <Search className="mx-auto h-12 w-12 text-muted" />
          <p className="mt-4 font-display font-bold text-xl">
            Aucun événement trouvé
          </p>
          <p className="mt-1 text-cream/60 text-sm">
            Essayez d'élargir vos filtres ou une autre recherche.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {results.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}

      {/* Price legend */}
      <p className="mt-6 text-xs text-muted">
        Prix affiché : billet le moins cher · ex. {formatFCFA(5000)} · Paiement
        Mobile Money & carte bancaire
      </p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-amber bg-amber text-ink"
          : "border-line/70 bg-ink-2 text-cream hover:border-amber/50 hover:text-amber"
      }`}
    >
      {label}
    </button>
  );
}

export default function RecherchePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 pt-10 text-cream/60">
          Chargement…
        </div>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}
