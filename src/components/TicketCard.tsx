"use client";

import QRCode from "react-qr-code";
import type { StoredTicket } from "@/lib/store";
import type { Event } from "@/lib/data";
import { dayMonthUpper, formatFCFA } from "@/lib/utils";
import { Ticket } from "lucide-react";

export default function TicketCard({ ticket, event }: { ticket: StoredTicket; event: Event }) {
  return (
    <div id="ticket-card" className="w-full max-w-sm mx-auto overflow-hidden rounded-3xl bg-cream text-ink shadow-2xl ticket-print-card">
      {/* Header */}
      <div className="sunset-gradient px-5 py-4 flex items-center justify-between">
        <p className="font-display font-bold tracking-widest text-white text-sm">
          LOMÉ EVENTS
        </p>
        <Ticket className="h-5 w-5 text-white" />
      </div>

      <div className="px-5 pt-4">
        <p className="font-display font-bold text-2xl leading-tight uppercase">
          {event.title}
        </p>
        <p className="mt-1 text-sm font-semibold text-ink/70 uppercase tracking-wide">
          {dayMonthUpper(event.date)} · {event.time}
        </p>
        <p className="text-sm text-ink/60">{event.venue}</p>
      </div>

      {/* QR + code */}
      <div className="px-5 py-5 flex items-center gap-4">
        <div id="qr-container" className="shrink-0 bg-white p-2.5 rounded-2xl border-2 border-ink/10">
          <QRCode value={ticket.code} size={110} />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-widest text-ink/50">Code billet</p>
          <p className="break-all font-display text-sm font-bold tracking-wider sm:text-base">
            {ticket.code}
          </p>
          <p className="mt-2 text-sm">
            <span className="text-ink/50">Billet :</span> <strong>{ticket.tierName}</strong>
          </p>
          <p className="text-sm">
            <span className="text-ink/50">Prix :</span>{" "}
            <strong>{formatFCFA(ticket.price)}</strong>
          </p>
        </div>
      </div>

      {/* Cut edge */}
      <div className="ticket-cut mx-5" />

      <p className="px-5 py-4 text-center text-xs font-medium text-ink/60">
        Présentez ce QR Code à l&apos;entrée
      </p>
    </div>
  );
}
