"use client";

// Store local persistant — conçu pour être remplacé par Supabase plus tard.

export type StoredTicket = {
  code: string;
  eventId: string;
  tierName: string;
  price: number;
  qty: number;
  fees: number;
  buyerName: string;
  purchasedAt: string;
  used: boolean;
};

const TICKETS_KEY = "lome-events:tickets";
const FAVS_KEY = "lome-events:favorites";
const SCANS_KEY = "lome-events:scans";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("lome-store-change"));
}

export function getTickets(): StoredTicket[] {
  return read<StoredTicket[]>(TICKETS_KEY, []);
}

export function saveTicket(ticket: StoredTicket) {
  write(TICKETS_KEY, [ticket, ...getTickets()]);
}

export function getFavorites(): string[] {
  return read<string[]>(FAVS_KEY, ["orn-city", "festival-de-lome", "conference-tech-togo"]);
}

export function toggleFavorite(eventId: string): string[] {
  const favs = getFavorites();
  const next = favs.includes(eventId)
    ? favs.filter((id) => id !== eventId)
    : [...favs, eventId];
  write(FAVS_KEY, next);
  return next;
}

export function isScanned(code: string): boolean {
  return read<string[]>(SCANS_KEY, []).includes(code);
}

export function markScanned(code: string) {
  const scans = read<string[]>(SCANS_KEY, []);
  if (!scans.includes(code)) write(SCANS_KEY, [...scans, code]);
}

export function makeTicketCode(): string {
  return `LE-${crypto.randomUUID().toUpperCase()}`;
}
