"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import type { Event } from "@/lib/data";
import { formatFCFA } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { CheckCircle2, CreditCard, LoaderCircle, ShieldCheck, Smartphone, Sparkles, Wallet } from "lucide-react";

export default function PaiementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const [event, setEvent] = useState<Event | null>(null);
  const [tierId, setTierId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [method, setMethod] = useState<"cinetpay" | "wallet">("cinetpay");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams(window.location.search);
    const selectedTierId = query.get("tierId") ?? "";
    const requestedQuantity = Number(query.get("qty") ?? 1);
    setTierId(selectedTierId);
    setQuantity(
      Number.isInteger(requestedQuantity) && requestedQuantity >= 1 && requestedQuantity <= 10
        ? requestedQuantity
        : 1,
    );

    Promise.all([
      fetch(`/api/events?id=${encodeURIComponent(id)}`)
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "Impossible de charger l’événement.");
          return result as Event[];
        })
        .then((events) => {
          if (active) setEvent(events[0] ?? null);
        }),
      fetch("/api/payments/wallet/balance")
        .then((res) => (res.ok ? res.json() : { balance: 0 }))
        .then((data: { balance?: number }) => {
          if (active && typeof data.balance === "number") {
            setWalletBalance(data.balance);
          }
        })
        .catch(() => {}),
    ])
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Impossible de charger les données.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const tier = event?.tiers.find((item) => item.id === tierId);
  const total = tier ? tier.price * quantity + 500 : 0;
  const canPayWithWallet = walletBalance !== null && walletBalance >= total && total > 0;

  // Auto-switch to wallet if user has enough credits and hasn't chosen yet
  useEffect(() => {
    if (canPayWithWallet) {
      setMethod("wallet");
    }
  }, [canPayWithWallet]);

  async function startPayment() {
    if (!tier?.id) return;
    setError("");
    setProcessing(true);

    try {
      if (!isSupabaseConfigured()) {
        throw new Error("Le paiement nécessite une connexion à Lomé Events.");
      }

      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw new Error(authError.message);
      if (!user) {
        window.location.assign(
          `/connexion?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`,
        );
        return;
      }

      if (method === "wallet") {
        const response = await fetch("/api/payments/wallet/pay", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ticketTypeId: tier.id, quantity }),
        });
        const result = (await response.json()) as { success?: boolean; error?: string };
        if (!response.ok || !result.success) {
          throw new Error(result.error ?? "Impossible de régler avec vos crédits.");
        }
        router.push("/billets?success=1");
        return;
      }

      const response = await fetch("/api/payments/cinetpay/initiate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticketTypeId: tier.id, quantity }),
      });
      const result = (await response.json()) as { paymentUrl?: string; error?: string };
      if (!response.ok || !result.paymentUrl) {
        throw new Error(result.error ?? "Impossible d’initialiser le paiement.");
      }
      window.location.assign(result.paymentUrl);
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Impossible d’effectuer le paiement.");
      setProcessing(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-lg px-4 py-20 text-center text-muted">Chargement du paiement…</div>;
  if (!event || !tier) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="font-display text-xl font-bold">Billet indisponible</h1>
        <p className="mt-2 text-sm text-muted">
          {error || "L’événement ou cette catégorie de billet n’est plus disponible."}
        </p>
        <Link href="/" className="mt-4 inline-block text-amber underline">
          Retour aux événements
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <Link href={`/checkout/${event.id}`} className="text-sm text-muted hover:text-cream">
        ← Retour
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Paiement</h1>
      <p className="mt-1 text-sm text-muted">{event.title}</p>

      {/* Recap */}
      <div className="mt-5 rounded-2xl border border-line bg-ink-2 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted">
            Billet {tier.name} · x{quantity}
          </span>
          <span>{formatFCFA(tier.price * quantity)}</span>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-muted">Frais de service</span>
          <span>{formatFCFA(500)}</span>
        </div>
        <div className="mt-3 flex justify-between border-t border-line pt-3">
          <span className="font-bold">TOTAL</span>
          <span className="font-display text-lg font-bold text-amber">{formatFCFA(total)}</span>
        </div>
      </div>

      <h2 className="mt-6 font-display text-lg font-bold">Mode de paiement</h2>
      <div className="mt-3 space-y-3">
        {/* Wallet Credit Option */}
        <button
          type="button"
          onClick={() => {
            if (canPayWithWallet) setMethod("wallet");
          }}
          disabled={!canPayWithWallet}
          className={`w-full rounded-2xl border p-4 text-left transition-all ${
            method === "wallet" && canPayWithWallet
              ? "border-togogreen bg-togogreen/10 ring-1 ring-togogreen"
              : canPayWithWallet
                ? "border-line bg-ink-2 hover:border-togogreen/50 cursor-pointer"
                : "border-line/60 bg-ink-2/50 opacity-60 cursor-not-allowed"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  canPayWithWallet ? "bg-togogreen/20 text-togogreen" : "bg-ink-3 text-muted"
                }`}
              >
                <Wallet className="h-5 w-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">Crédits Lomé Events</span>
                  {canPayWithWallet && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-togogreen/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-togogreen">
                      <Sparkles className="h-2.5 w-2.5" /> Instantané
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  Solde disponible :{" "}
                  <strong className={walletBalance && walletBalance > 0 ? "text-togogreen" : "text-cream"}>
                    {walletBalance !== null ? formatFCFA(walletBalance) : "Chargement…"}
                  </strong>
                </p>
                {!canPayWithWallet && walletBalance !== null && (
                  <p className="mt-1 text-[11px] text-togored">
                    Solde insuffisant (manque {formatFCFA(Math.max(0, total - walletBalance))})
                  </p>
                )}
              </div>
            </div>
            {method === "wallet" && canPayWithWallet && (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-togogreen" />
            )}
          </div>
        </button>

        {/* CinetPay Option (Mobile Money & Cards) */}
        <button
          type="button"
          onClick={() => setMethod("cinetpay")}
          className={`w-full rounded-2xl border p-4 text-left transition-all cursor-pointer ${
            method === "cinetpay"
              ? "border-amber bg-amber/10 ring-1 ring-amber"
              : "border-line bg-ink-2 hover:border-amber/50"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-3 text-amber">
                <Smartphone className="h-5 w-5" />
              </span>
              <div>
                <span className="font-bold">Mobile Money & Cartes (CinetPay)</span>
                <p className="mt-0.5 text-xs text-muted">T-Money, Moov Flooz et Cartes Bancaires</p>
              </div>
            </div>
            {method === "cinetpay" && <CheckCircle2 className="h-5 w-5 shrink-0 text-amber" />}
          </div>
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-togored/40 bg-togored/10 p-3 text-sm text-togored">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={processing}
        onClick={() => void startPayment()}
        className={`mt-6 flex w-full items-center justify-center gap-2 rounded-full py-4 font-display text-base font-bold transition hover:opacity-90 disabled:opacity-60 ${
          method === "wallet"
            ? "bg-togogreen text-white shadow-lg shadow-togogreen/25"
            : "sunset-gradient text-ink shadow-glow"
        }`}
      >
        {processing && <LoaderCircle className="h-5 w-5 animate-spin" />}
        {processing
          ? method === "wallet"
            ? "Validation de vos billets…"
            : "Redirection vers CinetPay…"
          : method === "wallet"
            ? `RÉGLER ${formatFCFA(total)} AVEC MES CRÉDITS`
            : `PAYER ${formatFCFA(total)}`}
      </button>

      <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs text-muted">
        <ShieldCheck className="h-3.5 w-3.5 text-togogreen" />
        {method === "wallet"
          ? "Vos billets sont émis instantanément sur votre compte."
          : "Les billets sont émis après confirmation sécurisée par CinetPay."}
      </p>
    </div>
  );
}
