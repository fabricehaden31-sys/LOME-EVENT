import Link from "next/link";
import CategoryChips from "@/components/CategoryChips";
import EventCard from "@/components/EventCard";
import type { Event } from "@/lib/data";
import { getPublicEvents } from "@/lib/events-server";
import { formatDateShortFR, formatFCFA } from "@/lib/utils";

export const dynamic = "force-dynamic";

const LOME_CENTER = { lat: 6.1319, lng: 1.2228 };

function distanceKm(e: Event) {
  const dx = (e.latitude - LOME_CENTER.lat) * 111;
  const dy =
    (e.longitude - LOME_CENTER.lng) *
    111 *
    Math.cos((LOME_CENTER.lat * Math.PI) / 180);
  return Math.sqrt(dx * dx + dy * dy);
}

function byDateAsc(a: Event, b: Event) {
  return `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`);
}

function Section({
  title,
  events,
  href,
  big = false,
}: {
  title: string;
  events: Event[];
  href: string;
  big?: boolean;
}) {
  if (events.length === 0) return null;
  return (
    <section className="mt-12 sm:mt-16">
      <div className="mb-5 flex items-end justify-between border-b border-line pb-3">
        <h2 className="font-display text-3xl sm:text-4xl">{title}</h2>
        <Link
          href={href}
          className="shrink-0 text-sm font-semibold text-togogreen transition-colors hover:text-ember"
        >
          Tout voir →
        </Link>
      </div>
      {big ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      ) : (
        <div className="no-scrollbar flex gap-4 overflow-x-auto -mx-4 px-4 pb-1">
          {events.map((e) => (
            <div key={e.id} className="w-52 shrink-0 sm:w-60">
              <EventCard event={e} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const SUGGESTIONS = [
  { label: "Concert", href: "/recherche?q=concert" },
  { label: "Festival", href: "/recherche?q=festival" },
  { label: "Conférence", href: "/recherche?q=conf%C3%A9rence" },
  { label: "Ce week-end", href: "/recherche?q=samedi" },
  { label: "Agoè", href: "/recherche?q=Ago%C3%A8" },
];

export default async function Home() {
  const EVENTS = await getPublicEvents();
  const featured = EVENTS.filter((e) => e.featured);
  const weekend = EVENTS.filter(
    (e) => e.featured !== true && new Date(`${e.date}T12:00:00`).getDay() !== 0
  )
    .filter((e) => [5, 6, 0].includes(new Date(`${e.date}T12:00:00`).getDay()))
    .sort(byDateAsc);
  const nearYou = [...EVENTS].sort((a, b) => distanceKm(a) - distanceKm(b)).slice(0, 6);
  const trending = EVENTS.filter((e) => e.trending);
  const fresh = EVENTS.filter((e) => e.isNew);
  const free = EVENTS.filter((e) => e.free || Math.min(...e.tiers.map((t) => t.price)) === 0);
  const spotlight = featured[0] ?? EVENTS[0];

  if (EVENTS.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <section className="rounded-[28px] border border-dashed border-line bg-ink-2 px-6 py-12 text-center shadow-glow sm:px-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-togogreen">Lomé Events</p>
          <h1 className="mt-4 font-display text-4xl font-bold text-cream sm:text-5xl">Aucun événement publié pour le moment.</h1>
          <p className="mt-4 mx-auto max-w-2xl text-sm leading-6 text-muted">
            Les événements seront affichés ici dès qu’ils seront ajoutés à la plateforme.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/recherche" className="primary-action rounded-sm px-5 py-3 font-semibold">
              Explorer la plateforme
            </Link>
            <Link href="/organisateur" className="rounded-sm border border-line bg-ink px-5 py-3 font-semibold text-cream hover:border-togogreen hover:text-togogreen">
              Publier un événement
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="hero-mesh home-ambient -mx-4 grid gap-8 px-4 py-9 sm:-mx-6 sm:px-6 sm:py-12 lg:grid-cols-[1fr_0.82fr] lg:items-center lg:gap-12 lg:py-14">
        <div className="editorial-enter relative z-10 max-w-2xl">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-togogreen">
            <span className="h-px w-8 bg-togogreen" /> Lomé, Togo · Octobre 2026
          </p>
          <h1 className="mt-5 max-w-xl font-display text-5xl leading-[0.98] sm:text-6xl lg:text-7xl">
            Tout ce qui se passe <span className="sunset-text">à Lomé.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base text-muted sm:text-lg">
            La ville a toujours quelque chose à raconter. Trouvez votre prochain concert,
            festival ou rendez-vous, puis réservez votre place.
          </p>
          <form action="/recherche" className="mt-7 flex max-w-xl" role="search">
            <label htmlFor="home-q" className="sr-only">
              Rechercher un événement
            </label>
            <input
              id="home-q"
              name="q"
              type="search"
              placeholder="Un concert, un quartier, une date…"
              className="min-w-0 flex-1 rounded-l-sm border border-line border-r-0 bg-ink-2 px-4 py-3.5 text-base placeholder:text-muted focus:border-togogreen focus:outline-none"
            />
            <button
              type="submit"
              className="primary-action rounded-r-sm px-5 py-3.5 text-sm font-bold sm:px-6"
            >
              Explorer
            </button>
          </form>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <span className="text-muted">À découvrir :</span>
            {SUGGESTIONS.map((suggestion) => (
              <Link
                key={suggestion.label}
                href={suggestion.href}
                className="font-semibold text-cream underline decoration-line underline-offset-4 transition-colors hover:text-togogreen"
              >
                {suggestion.label}
              </Link>
            ))}
          </div>
        </div>

        <Link
          href={`/evenements/${spotlight.id}`}
          className="group relative z-10 isolate flex min-h-[390px] flex-col justify-between overflow-hidden rounded-sm bg-cream p-5 text-white sm:min-h-[470px] sm:p-7"
          style={{
            backgroundImage:
              'linear-gradient(180deg, rgba(18, 31, 24, 0.08) 0%, rgba(18, 31, 24, 0.1) 42%, rgba(18, 31, 24, 0.88) 100%), url("https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1400&q=85")',
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
          aria-label={`Découvrir ${spotlight.title}`}
        >
          <span className="w-fit bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#18251e]">
            À la une · {formatDateShortFR(spotlight.date)}
          </span>
          <div className="transition-transform duration-300 group-hover:-translate-y-1">
            <p className="text-sm font-semibold text-white/80">
              {spotlight.venue} · Dès {formatFCFA(Math.min(...spotlight.tiers.map((tier) => tier.price)))}
            </p>
            <p className="mt-1 font-display text-5xl leading-none sm:text-6xl">
              {spotlight.title}
            </p>
            <span className="mt-4 inline-flex items-center gap-2 border-b border-white/70 pb-1 text-sm font-semibold">
              Voir l&apos;événement <span aria-hidden="true">→</span>
            </span>
          </div>
        </Link>
      </section>

      <section className="mt-7 border-y border-line py-4 sm:mt-9">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-muted">
          Parcourir par catégorie
        </p>
        <CategoryChips />
      </section>

      <Section title="À la une" events={featured} href="/recherche" big />
      <Section title="Ce week-end" events={weekend} href="/recherche?date=weekend" />
      <Section title="Près de vous" events={nearYou} href="/recherche?lieu=Centre-ville" />
      <Section title="Tendances à Lomé" events={trending} href="/recherche" />
      <Section title="Nouveaux événements" events={fresh} href="/recherche" />
      <Section title="Événements gratuits" events={free} href="/recherche?prix=gratuit" />

      {/* Organizer CTA */}
      <section className="my-14">
        <Link
          href="/organisateur"
          className="primary-action flex flex-col items-start justify-between gap-5 rounded-sm p-6 text-white sm:flex-row sm:items-center sm:p-10"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/75">
              Espace organisateur
            </p>
            <p className="mt-2 font-display text-3xl sm:text-4xl">
              Vous organisez un événement ?
            </p>
            <p className="mt-1 max-w-md text-sm text-white/80">
              Créez votre événement, gérez vos billets et suivez vos ventes en
              temps réel.
            </p>
          </div>
          <span className="shrink-0 rounded-sm bg-white px-6 py-3 text-sm font-bold text-togogreen">
            Commencer →
          </span>
        </Link>
      </section>
    </div>
  );
}
