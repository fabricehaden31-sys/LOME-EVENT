"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { saveTicket } from "@/lib/store";
import { formatFCFA } from "@/lib/utils";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  Phone,
  ShieldCheck,
  Smartphone,
  XCircle,
} from "lucide-react";

function SandboxContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const transactionId = searchParams.get("transactionId") || `TX-${Date.now().toString(36)}`;
  const amount = Number(searchParams.get("amount") || 5500);
  const eventTitle = searchParams.get("title") || "Concert / Événement Lomé Events";
  const eventId = searchParams.get("eventId") || "event-1";
  const tierName = searchParams.get("tierName") || "Standard";
  const quantity = Number(searchParams.get("qty") || 1);

  const [provider, setProvider] = useState<"tmoney" | "flooz" | "card">("tmoney");
  const [phoneNumber, setPhoneNumber] = useState("90 12 34 56");
  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const handleSimulateSuccess = async () => {
    setProcessing(true);
    setStatusMessage("Simulation de validation USSD en cours…");

    await new Promise((resolve) => setTimeout(resolve, 1200));

    // Save tickets to local client store as reliable sandbox fallback
    for (let i = 0; i < quantity; i++) {
      const code = `LE-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random()
        .toString(36)
        .substring(2, 6)
        .toUpperCase()}`;
      saveTicket({
        code,
        eventId,
        tierName,
        price: Math.max(0, amount - 500) / quantity,
        qty: 1,
        fees: 500 / quantity,
        buyerName: "Client Sandbox",
        purchasedAt: new Date().toISOString(),
        used: false,
      });
    }

    router.push("/billets?success=1");
  };

  const handleSimulateFailure = () => {
    router.push(`/paiement/retour?status=failed&reason=${encodeURIComponent("Solde mobile money insuffisant (Simulé)")}`);
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Link href="/billets" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-cream">
        <ArrowLeft className="h-4 w-4" />
        Retour
      </Link>

      <div className="mt-4 rounded-3xl border border-amber/30 bg-ink-2 p-6 shadow-glow">
        <div className="flex items-center justify-between">
          <span className="rounded-full border border-amber/40 bg-amber/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber">
            Sandbox Lomé Events
          </span>
          <span className="text-xs text-muted">Test local sans frais</span>
        </div>

        <h1 className="mt-3 font-display text-2xl font-bold text-cream">
          Simulateur de Paiement Togo
        </h1>
        <p className="mt-1 text-xs text-muted">
          Cet environnement simule la passerelle CinetPay / T-Money / Flooz de bout en bout.
        </p>

        {/* Détails transaction */}
        <div className="mt-5 rounded-2xl border border-line bg-ink p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Événement</span>
            <span className="font-semibold text-cream text-right">{eventTitle}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Billet</span>
            <span>{quantity}x {tierName}</span>
          </div>
          <div className="flex justify-between border-t border-line/60 pt-2 font-bold">
            <span>Montant à régler</span>
            <span className="text-amber text-base">{formatFCFA(amount)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted">
            <span>Réf. Transaction</span>
            <span className="font-mono text-[11px]">{transactionId}</span>
          </div>
        </div>

        {/* Choix du mode Mobile Money */}
        <div className="mt-5 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted">
            Opérateur simulé :
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setProvider("tmoney")}
              className={`rounded-2xl border p-3 text-center transition ${
                provider === "tmoney"
                  ? "border-togogreen bg-togogreen/15 text-togogreen font-bold"
                  : "border-line/60 bg-ink text-muted hover:border-line"
              }`}
            >
              <Smartphone className="mx-auto h-5 w-5 mb-1 text-togogreen" />
              <span className="text-xs">T-Money</span>
            </button>

            <button
              type="button"
              onClick={() => setProvider("flooz")}
              className={`rounded-2xl border p-3 text-center transition ${
                provider === "flooz"
                  ? "border-[#ff6b00] bg-[#ff6b00]/15 text-[#ff6b00] font-bold"
                  : "border-line/60 bg-ink text-muted hover:border-line"
              }`}
            >
              <Smartphone className="mx-auto h-5 w-5 mb-1 text-[#ff6b00]" />
              <span className="text-xs">Flooz</span>
            </button>

            <button
              type="button"
              onClick={() => setProvider("card")}
              className={`rounded-2xl border p-3 text-center transition ${
                provider === "card"
                  ? "border-amber bg-amber/15 text-amber font-bold"
                  : "border-line/60 bg-ink text-muted hover:border-line"
              }`}
            >
              <CreditCard className="mx-auto h-5 w-5 mb-1 text-amber" />
              <span className="text-xs">Carte</span>
            </button>
          </div>
        </div>

        {/* Numéro de téléphone */}
        {provider !== "card" && (
          <div className="mt-4">
            <label className="text-xs text-muted block mb-1">
              Numéro de téléphone Togo (+228) :
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-xs font-semibold text-muted">
                +228
              </span>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full rounded-xl border border-line/60 bg-ink py-2.5 pl-14 pr-4 text-sm text-cream focus:border-amber focus:outline-none"
              />
            </div>
            <p className="mt-1 text-[11px] text-muted">
              {provider === "tmoney" ? "Numéro T-Money (Mixx by Yas)" : "Numéro Flooz (Moov Africa)"}
            </p>
          </div>
        )}

        {statusMessage && (
          <p className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-amber/10 p-3 text-center text-xs font-semibold text-amber">
            <Loader2 className="h-4 w-4 animate-spin" />
            {statusMessage}
          </p>
        )}

        {/* Boutons d'action */}
        <div className="mt-6 space-y-3">
          <button
            onClick={handleSimulateSuccess}
            disabled={processing}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-togogreen px-5 py-3.5 text-center font-bold text-white shadow-lg hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
          >
            {processing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Validation…</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5" />
                <span>Simuler le paiement réussi</span>
              </>
            )}
          </button>

          <button
            onClick={handleSimulateFailure}
            disabled={processing}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-togored/40 bg-ink px-4 py-2.5 text-center text-xs font-semibold text-togored hover:bg-togored/10 transition cursor-pointer"
          >
            <XCircle className="h-4 w-4" />
            <span>Simuler un échec ou annulation</span>
          </button>
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-togogreen" />
          <span>Transactions test isolées de la production</span>
        </div>
      </div>
    </div>
  );
}

export default function SandboxPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-muted">Chargement du simulateur…</div>}>
      <SandboxContent />
    </Suspense>
  );
}
