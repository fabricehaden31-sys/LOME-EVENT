"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import type { Event } from "@/lib/data";
import { type StoredTicket } from "@/lib/store";
import { formatDateFR, formatFCFA } from "@/lib/utils";
import TicketCard from "@/components/TicketCard";
import { downloadTicketImage, shareTicketWhatsApp, printTicket } from "@/lib/ticket-export";
import { Check, Copy, Download, Loader2, Printer, Search, Share2, ShieldAlert } from "lucide-react";

export default function BilletDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const [ticket, setTicket] = useState<StoredTicket | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/tickets")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Impossible de charger vos billets.");
        return result as StoredTicket[];
      })
      .then(async (tickets) => {
        const foundTicket = tickets.find((item) => item.code === code);
        if (!active) return;
        setTicket(foundTicket ?? null);
        if (!foundTicket) return;
        const response = await fetch(`/api/events?id=${encodeURIComponent(foundTicket.eventId)}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Impossible de charger l’événement.");
        if (active) setEvent((result as Event[])[0] ?? null);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Impossible de charger le billet.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [code]);

  if (loading) {
    return <div className="mx-auto max-w-lg px-4 py-20 text-center text-muted">Chargement du billet…</div>;
  }

  if (error || !ticket) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <Search className="mx-auto h-10 w-10 text-muted" />
        <h1 className="mt-3 font-display text-xl font-bold">{error ? "Billet indisponible" : "Billet introuvable"}</h1>
        <p role={error ? "alert" : undefined} className="mt-1 text-sm text-muted">
          {error || "Ce code ne correspond à aucun billet payé de votre compte."}
        </p>
        <Link href="/billets" className="mt-4 inline-block text-amber underline underline-offset-4">Voir mes billets</Link>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center text-muted">
        Les détails de l’événement ne sont plus disponibles.
      </div>
    );
  }

  const handleDownload = async () => {
    if (!ticket || !event || isExporting) return;
    setIsExporting(true);
    try {
      await downloadTicketImage(ticket, event);
    } catch {
      alert("Erreur lors de la création de l’image du billet.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleWhatsAppShare = async () => {
    if (!ticket || !event) return;
    try {
      await shareTicketWhatsApp(ticket, event);
    } catch {
      alert("Impossible d’ouvrir le partage WhatsApp.");
    }
  };

  const handleCopyCode = async () => {
    if (!ticket) return;
    try {
      await navigator.clipboard.writeText(ticket.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href="/billets" className="text-sm text-muted hover:text-cream">
          ← Mes billets
        </Link>
        <button
          onClick={handleCopyCode}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-ink-2 px-3 py-1.5 text-xs font-medium text-cream hover:border-amber transition"
        >
          {copiedCode ? (
            <>
              <Check className="h-3.5 w-3.5 text-togogreen" />
              <span>Copié !</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-muted" />
              <span>Copier le code</span>
            </>
          )}
        </button>
      </div>

      <div className="mt-2">
        <TicketCard ticket={ticket} event={event} />
      </div>

      {/* Action Buttons: Download & WhatsApp */}
      <div className="no-print mt-6 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleDownload}
            disabled={isExporting}
            className="flex items-center justify-center gap-2 rounded-xl bg-amber px-4 py-3.5 text-center text-sm font-bold text-ink hover:opacity-90 transition disabled:opacity-50 shadow-lg cursor-pointer"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Génération...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Enregistrer (PNG)</span>
              </>
            )}
          </button>

          <button
            onClick={handleWhatsAppShare}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3.5 text-center text-sm font-bold text-white hover:bg-[#20ba59] transition shadow-lg cursor-pointer"
          >
            <Share2 className="h-4 w-4" />
            <span>WhatsApp</span>
          </button>
        </div>

        <button
          onClick={printTicket}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-line bg-ink-2 px-4 py-2.5 text-center text-xs font-semibold text-cream hover:bg-ink hover:border-cream/20 transition cursor-pointer"
        >
          <Printer className="h-4 w-4 text-muted" />
          <span>Imprimer ou Enregistrer en PDF</span>
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-ink-2 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Date</span>
          <span>{formatDateFR(event.date)}</span>
        </div>
        <div className="mt-2 flex justify-between">
          <span className="text-muted">Heure</span>
          <span>{event.time}</span>
        </div>
        <div className="mt-2 flex justify-between">
          <span className="text-muted">Lieu</span>
          <span className="text-right">{event.venue}</span>
        </div>
        <div className="mt-2 flex justify-between">
          <span className="text-muted">Adresse</span>
          <span className="text-right">{event.address}</span>
        </div>
        <div className="mt-2 flex justify-between">
          <span className="text-muted">Total payé</span>
          <span className="font-bold text-amber">
            {formatFCFA(ticket.price + ticket.fees)}
          </span>
        </div>
      </div>

      {ticket.used && (
        <p className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-togored/10 px-4 py-3 text-center text-sm font-bold text-togored">
          <ShieldAlert className="h-4 w-4" />
          Ce billet a déjà été scanné à l&apos;entrée
        </p>
      )}

      <p className="mt-4 text-center text-xs text-muted">
        Présentez ce QR Code à l&apos;entrée — un seul scan par billet
      </p>
    </div>
  );
}
