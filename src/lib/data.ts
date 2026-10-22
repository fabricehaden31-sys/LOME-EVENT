import type { IconName } from "@/lib/icons";

export type Category = {
  id: string;
  label: string;
  emoji: IconName;
};

export const CATEGORIES: Category[] = [
  { id: "concerts", label: "Concerts", emoji: "music2" },
  { id: "soirees", label: "Soirées", emoji: "sparkles" },
  { id: "sport", label: "Sport", emoji: "trophy" },
  { id: "business", label: "Business", emoji: "briefcase" },
  { id: "formations", label: "Formations", emoji: "graduation" },
  { id: "culture", label: "Culture", emoji: "palette" },
  { id: "festivals", label: "Festivals", emoji: "party" },
  { id: "famille", label: "Famille", emoji: "users" },
  { id: "networking", label: "Networking", emoji: "globe" },
];

export type Organizer = {
  id: string;
  name: string;
  verified: boolean;
  initials: string;
  color: string;
  eventsCount: number;
  rating: number;
};

export const ORGANIZERS: Organizer[] = [
  { id: "orn-live", name: "ORN Live", verified: true, initials: "ORN", color: "#f5a524", eventsCount: 12, rating: 4.9 },
  { id: "keregue-prod", name: "Kégué Productions", verified: true, initials: "KP", color: "#27ae60", eventsCount: 8, rating: 4.7 },
  { id: "lome-tech-hub", name: "Lomé Tech Hub", verified: true, initials: "LTH", color: "#3498db", eventsCount: 15, rating: 4.8 },
  { id: "agoe-events", name: "Agoè Events", verified: false, initials: "AE", color: "#e74c3c", eventsCount: 3, rating: 4.2 },
  { id: "culture-to", name: "Culture Togo", verified: true, initials: "CT", color: "#9b59b6", eventsCount: 6, rating: 4.6 },
  { id: "plage-lome", name: "Plage de Lomé", verified: true, initials: "PL", color: "#1abc9c", eventsCount: 5, rating: 4.5 },
];

export type TicketTier = {
  id?: string;
  name: string;
  price: number;
  quota: number;
  sold: number;
  perks: string[];
};

export type ProgramStep = { time: string; label: string };

export type Event = {
  id: string;
  title: string;
  category: string;
  date: string; // YYYY-MM-DD — octobre 2026
  time: string;
  venue: string;
  address: string;
  district: string; // quartier pour "Près de vous" / filtre lieu
  organizerId: string;
  organizerName?: string;
  organizerVerified?: boolean;
  description: string;
  program: ProgramStep[];
  tiers: TicketTier[];
  featured?: boolean;
  trending?: boolean;
  isNew?: boolean;
  free?: boolean;
  poster: [string, string, string]; // 3 couleurs du dégradé d'affiche
  posterUrl?: string | null;
  emoji: IconName;
  latitude: number;
  longitude: number;
};

export const FRAIS = 500; // frais de service fixes

export const EVENTS: Event[] = [];

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  initials: string;
  color: string;
};

export const CURRENT_USER: User = {
  id: "user-1",
  name: "Afi Mensah",
  email: "afi.mensah@gmail.com",
  phone: "+228 90 12 34 56",
  initials: "AM",
  color: "#f5a524",
};

export type AppNotification = {
  id: string;
  icon: IconName;
  title: string;
  body: string;
  time: string;
  read: boolean;
};

export const NOTIFICATIONS: AppNotification[] = [
];

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "Participant" | "Organisateur" | "Admin";
  status: "Actif" | "Suspendu";
  joined: string;
};

export const ADMIN_USERS: AdminUser[] = [];

export type AdminEvent = {
  id: string;
  title: string;
  organizer: string;
  date: string;
  status: "Publié" | "En attente" | "Rejeté";
};

export const ADMIN_EVENTS: AdminEvent[] = [];

export const PAYMENTS: { id: string; method: string; amount: number; status: string; time: string }[] = [];

export const REPORTS: { id: string; subject: string; event: string; reporter: string; status: string }[] = [];

// --- Helpers ---
export function getEvent(id: string): Event | undefined {
  return EVENTS.find((e) => e.id === id);
}

export function getOrganizer(id: string): Organizer {
  return ORGANIZERS.find((o) => o.id === id) ?? {
    id,
    name: "Organisateur",
    verified: false,
    initials: "OR",
    color: "#f5a524",
    eventsCount: 0,
    rating: 0,
  };
}

export function eventsByOrganizer(organizerId: string): Event[] {
  return EVENTS.filter((e) => e.organizerId === organizerId);
}

export function minPrice(event: Event): number {
  return Math.min(...event.tiers.map((t) => t.price));
}

export function remainingSeats(event: Event): number {
  return event.tiers.reduce((acc, t) => acc + (t.quota - t.sold), 0);
}
