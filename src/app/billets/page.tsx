"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Event } from "@/lib/data";
import { getTickets, type StoredTicket } from "@/lib/store";
import { formatDateShortFR, formatFCFA } from "@/lib/utils";
import { CheckCircle2, Ticket } from "lucide-react";

export default function BilletsPage() {
  const [tickets, setTickets] = useState<StoredTicket[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [purchasedSuccess, setPurchasedSuccess] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("success") === "1") {
      setPurchasedSuccess(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const loadLocal = () => setTickets(getTickets());
    window.addEventListener("lome-store-change", loadLocal);
    Promise.all([
      fetch("/api/tickets").then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Impossible de charger vos billets.");
        return result as StoredTicket[];
      }),
      fetch("/api/events").then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Impossible de charger les événements.");
        return result as Event[];
      }),
    ]).then(([storedTickets, availableEvents]) => {
      if (!active) return;
      setTickets(storedTickets);
      setEvents(availableEvents);
    }).catch((loadError: unknown) => {
      if (active) {
        loadLocal();
        setError(loadError instanceof Error ? loadError.message : "Impossible de charger vos billets.");
      }
    }).finally(() => { if (active) setReady(true); });
    return () => {
      active = false;
      window.removeEventListener("lome-store-change", loadLocal);
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Mes billets</h1>
      <p className="mt-1 text-sm text-muted">
        Vos billets numériques avec QR Code unique
      </p>
      {purchasedSuccess && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-togogreen/40 bg-togogreen/10 p-4 text-sm text-togogreen">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">Commande validée avec succès !</p>
            <p className="text-xs text-togogreen/90">
              Vos billets sont enregistrés sur votre compte et prêts à être présentés à l&apos;entrée.
            </p>
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-togored">{error}</p>}

      {ready && tickets.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-line bg-ink-2/50 px-6 py-14 text-center">
          <Ticket className="mx-auto h-10 w-10 text-muted" />
          <p className="mt-3 font-display text-lg font-bold">
            Aucun billet pour le moment
          </p>
          <p className="mt-1 text-sm text-muted">
            Réservez vos places pour les meilleurs événements de Lomé.
          </p>
          <Link
            href="/"
            className="sunset-gradient mt-6 inline-block rounded-full px-6 py-3 font-display text-sm font-bold text-ink transition hover:opacity-90"
          >
            Découvrir les événements
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {tickets.map((t) => {
            const event = events.find((item) => item.id === t.eventId);
            const total = t.price * t.qty + t.fees;
            return (
              <Link
                key={t.code}
                href={`/billets/${t.code}`}
                className="block overflow-hidden rounded-2xl border border-line bg-ink-2 transition hover:border-amber/40"
              >
                <div className="flex items-stretch">
                  <div
                    className="w-2 shrink-0"
                    style={{ backgroundColor: event?.poster[0] ?? "#f5a524" }}
                  />
                  <div className="min-w-0 flex-1 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-display font-bold">
                          {event?.title ?? "Événement"}
                        </p>
                        <p className="mt-0.5 text-xs text-amber">
                          {event ? `${formatDateShortFR(event.date)} · ${event.time}` : ""}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {event?.venue ?? ""}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          t.used
                            ? "bg-togored/15 text-togored"
                            : "bg-togogreen/15 text-togogreen"
                        }`}
                      >
                        {t.used ? "Utilisé" : "Valide"}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm">
                      <span className="text-muted">
                        Billet <strong className="text-cream">{t.tierName}</strong> · x
                        {t.qty}
                      </span>
                      <span className="font-bold">{formatFCFA(total)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
