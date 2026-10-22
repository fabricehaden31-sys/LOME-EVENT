"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import type { Event } from "@/lib/data";
import { formatFCFA } from "@/lib/utils";

export default function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [tierId, setTierId] = useState("");
  const [qty, setQty] = useState(1);

  useEffect(() => {
    let active = true;
    fetch(`/api/events?id=${encodeURIComponent(id)}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Impossible de charger l’événement.");
        return result as Event[];
      })
      .then((events) => {
        if (!active) return;
        const fetchedEvent = events[0] ?? null;
        setEvent(fetchedEvent);
        setTierId(fetchedEvent?.tiers[0]?.id ?? "");
      })
      .catch(() => { if (active) setEvent(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="p-8 text-center text-muted">Chargement de l’événement…</div>;
  if (!event) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted">Événement introuvable ou non disponible.</p>
        <Link href="/" className="text-amber underline text-sm">Retour à l&apos;accueil</Link>
      </div>
    );
  }

  const tier = event.tiers.find((item) => item.id === tierId) ?? event.tiers[0];
  const subtotal = tier.price * qty;
  const total = subtotal + 500;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href={`/evenements/${event.id}`} className="text-sm text-muted hover:text-amber">← {event.title}</Link>
      <h1 className="mt-3 font-display text-2xl font-bold">Choisissez votre billet</h1>
      <div className="mt-5 space-y-3">
        {event.tiers.map((item) => {
          const active = item.id === tier.id;
          const left = item.quota - item.sold;
          return (
            <button
              key={item.id ?? item.name}
              type="button"
              onClick={() => item.id && setTierId(item.id)}
              disabled={!item.id || left <= 0}
              className={`w-full rounded-2xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                active ? "border-amber bg-amber/10" : "border-line bg-ink-2 hover:border-amber/50"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-display font-bold">{item.name.toUpperCase()}</p>
                  <p className="mt-0.5 text-xs text-muted">{item.perks.join(" · ")}</p>
                </div>
                <div className="text-right">
                  <p className="font-display font-bold">{item.price === 0 ? "Gratuit" : formatFCFA(item.price)}</p>
                  <p className={left > 0 ? "text-xs text-togogreen" : "text-xs text-togored"}>
                    {left > 0 ? `${left} disponible${left > 1 ? "s" : ""}` : "Épuisé"}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-6 flex items-center justify-between rounded-2xl border border-line bg-ink-2 p-4">
        <p className="font-semibold">Quantité</p>
        <div className="flex items-center gap-4">
          <button type="button" aria-label="Réduire" onClick={() => setQty((current) => Math.max(1, current - 1))} className="h-9 w-9 rounded-full border border-line text-lg">−</button>
          <span className="w-6 text-center font-display font-bold">{qty}</span>
          <button type="button" aria-label="Augmenter" onClick={() => setQty((current) => Math.min(10, current + 1))} className="h-9 w-9 rounded-full border border-line text-lg">+</button>
        </div>
      </div>
      <div className="mt-6 rounded-2xl border border-line bg-ink-2 p-5">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted">Billet {tier.name} · x{qty}</span><span>{formatFCFA(subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted">Frais de service</span><span>{formatFCFA(500)}</span></div>
        </div>
        <div className="mt-3 flex justify-between border-t border-line pt-3 font-display text-lg font-bold">
          <span>TOTAL</span><span className="text-amber">{formatFCFA(total)}</span>
        </div>
      </div>
      <button
        type="button"
        disabled={!tier.id || tier.quota - tier.sold < qty}
        onClick={() => router.push(`/paiement/${event.id}?tierId=${encodeURIComponent(tier.id ?? "")}&qty=${qty}`)}
        className="sunset-gradient mt-6 w-full rounded-full py-4 font-display text-lg font-bold text-ink shadow-glow hover:opacity-90 disabled:opacity-50"
      >
        PAYER {formatFCFA(total)}
      </button>
      <p className="mt-3 text-center text-xs text-muted">Le stock sera vérifié à nouveau au moment de la commande.</p>
    </div>
  );
}
