import Link from "next/link";
import { notFound } from "next/navigation";
import EventCard from "@/components/EventCard";
import {
  CATEGORIES,
  FRAIS,
  getOrganizer,
  minPrice,
  remainingSeats,
} from "@/lib/data";
import { getIcon } from "@/lib/icons";
import { formatDateFR } from "@/lib/utils";
import { getPublicEvents } from "@/lib/events-server";
import { ArrowLeft, MapPin } from "lucide-react";

function formatFCFA(n: number) {
  return `${n.toLocaleString("fr-FR").replace(/[\u202f\u00a0]/g, " ")} FCFA`;
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const EVENTS = await getPublicEvents();
  const event = EVENTS.find((item) => item.id === id);
  if (!event) notFound();
  const organizer = event.organizerName
    ? { ...getOrganizer(event.organizerId), name: event.organizerName, verified: event.organizerVerified ?? false }
    : getOrganizer(event.organizerId);
  const category = CATEGORIES.find((c) => c.id === event.category);
  const others = EVENTS.filter(
    (e) => e.organizerId === organizer.id && e.id !== event.id
  ).slice(0, 4);
  const seats = remainingSeats(event);

  return (
    <div>
      {/* Poster hero */}
      <div
        className="poster relative h-64 sm:h-96 -mx-4"
        style={
          {
            "--poster-a": event.poster[0],
            "--poster-b": event.poster[1],
            "--poster-c": event.poster[2],
          } as React.CSSProperties
        }
      >
        <Link
          href="/"
          className="absolute top-4 left-4 z-10 w-9 h-9 rounded-full bg-ink/60 backdrop-blur flex items-center justify-center text-cream hover:bg-ink/80 transition-colors"
          aria-label="Retour"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/12 text-white shadow-lg backdrop-blur-sm sm:h-20 sm:w-20">
            {(() => {
              const Icon = getIcon(event.emoji);
              return <Icon className="h-7 w-7 sm:h-9 sm:w-9" />;
            })()}
          </span>
          <h1 className="mt-4 font-display text-3xl sm:text-5xl font-bold uppercase tracking-tight text-white drop-shadow-lg">
            {event.title}
          </h1>
          <p className="mt-2 flex items-center gap-2 text-sm sm:text-base font-semibold text-white/90">
            {category && (() => { const Icon = getIcon(category.emoji); return <Icon className="h-4 w-4" />; })()}
            <span>{category?.label} · {formatDateFR(event.date)} · {event.time}</span>
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Quick facts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-ink-2 border border-line p-4">
            <p className="text-xs text-muted uppercase tracking-wide">Date</p>
            <p className="mt-1 font-display font-bold">{formatDateFR(event.date)}</p>
          </div>
          <div className="rounded-2xl bg-ink-2 border border-line p-4">
            <p className="text-xs text-muted uppercase tracking-wide">Heure</p>
            <p className="mt-1 font-display font-bold">{event.time}</p>
          </div>
          <div className="rounded-2xl bg-ink-2 border border-line p-4">
            <p className="text-xs text-muted uppercase tracking-wide">Tarif</p>
            <p className="mt-1 font-display font-bold">
              {minPrice(event) === 0 ? "Gratuit" : formatFCFA(minPrice(event))}
            </p>
          </div>
          <div className="rounded-2xl bg-ink-2 border border-line p-4">
            <p className="text-xs text-muted uppercase tracking-wide">Places</p>
            <p className="mt-1 font-display font-bold text-togogreen">
              {seats.toLocaleString("fr-FR")} dispo
            </p>
          </div>
        </div>

        {/* Venue */}
        <section className="mt-8">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold"><MapPin className="h-4 w-4 text-amber" /> Lieu</h2>
          <div className="mt-3 rounded-2xl bg-ink-2 border border-line p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-8">
            <div>
              <p className="font-semibold">{event.venue}</p>
              <p className="text-sm text-muted">{event.address}</p>
              <p className="text-xs text-muted mt-1">Quartier : {event.district}</p>
            </div>
            <div className="sm:ml-auto text-xs text-muted">
              GPS : {event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}
            </div>
          </div>
        </section>

        {/* Description */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold">À propos</h2>
          <p className="mt-3 text-sm leading-7 text-cream/85">{event.description}</p>
        </section>

        {/* Program */}
        {event.program.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-lg font-bold">Programme</h2>
            <ol className="mt-4 space-y-0">
              {event.program.map((step, i) => (
                <li key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="w-3 h-3 rounded-full bg-amber mt-1 shrink-0" />
                    {i < event.program.length - 1 && (
                      <span className="w-px flex-1 bg-line" />
                    )}
                  </div>
                  <div className="pb-5">
                    <p className="font-display font-bold text-amber">{step.time}</p>
                    <p className="text-sm text-cream/85">{step.label}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Tiers */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold">Billets</h2>
          <div className="mt-3 space-y-3">
            {event.tiers.map((t) => {
              const left = t.quota - t.sold;
              return (
                <div
                  key={t.name}
                  className="rounded-2xl bg-ink-2 border border-line p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <div className="flex-1">
                    <p className="font-display font-bold">{t.name}</p>
                    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {t.perks.map((p) => (
                        <li key={p} className="text-xs text-muted">
                          ✓ {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display font-bold">
                      {t.price === 0 ? "Gratuit" : formatFCFA(t.price)}
                    </p>
                    <p className={left > 0 ? "text-xs text-togogreen" : "text-xs text-togored"}>
                      {left > 0 ? `${left} disponibles` : "Épuisé"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">
            + {FRAIS.toLocaleString("fr-FR")} FCFA de frais de service par commande.
          </p>
        </section>

        {/* Organizer */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold">Organisateur</h2>
          <div className="mt-3 rounded-2xl bg-ink-2 border border-line p-5 flex items-center gap-4">
            <span
              className="w-12 h-12 rounded-full flex items-center justify-center font-display font-bold text-ink text-sm shrink-0"
              style={{ backgroundColor: organizer.color }}
            >
              {organizer.initials}
            </span>
            <div className="flex-1">
              <p className="font-semibold">{organizer.name}</p>
              <p className="text-xs text-muted mt-0.5">
                {organizer.eventsCount} événements · Note {organizer.rating}/5
              </p>
              {organizer.verified && (
                <p className="text-xs text-togogreen font-semibold mt-0.5">
                  ✓ Organisateur vérifié
                </p>
              )}
            </div>
          </div>
          {others.length > 0 && (
            <>
              <p className="mt-6 text-sm font-semibold text-muted">
                Autres événements de {organizer.name}
              </p>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
                {others.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            </>
          )}
        </section>

        {/* Sticky CTA */}
        <div className="sticky bottom-20 lg:bottom-6 mt-10 z-30">
          <div className="rounded-2xl bg-ink-2/95 backdrop-blur border border-line p-4 flex items-center gap-4 shadow-glow">
            <div className="flex-1 min-w-0">
              <p className="font-display font-bold truncate">{event.title}</p>
              <p className="text-xs text-muted">
                {minPrice(event) === 0 ? "Entrée libre" : `Dès ${formatFCFA(minPrice(event))}`}
              </p>
            </div>
            <Link
              href={`/checkout/${event.id}`}
              className="sunset-gradient rounded-full px-6 py-3 text-sm font-bold text-ink hover:opacity-90 transition-opacity shrink-0"
            >
              Acheter un billet
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
