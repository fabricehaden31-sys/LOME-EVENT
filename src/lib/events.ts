import { CATEGORIES, type Event, type ProgramStep, type TicketTier } from "@/lib/data";
import type { Json } from "@/lib/supabase/database.types";

const POSTER_COLORS: Record<string, [string, string, string]> = {
  concerts: ["#bf3e28", "#f5a524", "#25150f"],
  soirees: ["#542879", "#d64e70", "#191126"],
  sport: ["#1c6b53", "#b3a12d", "#13291f"],
  business: ["#245c78", "#4c9db2", "#112734"],
  formations: ["#3156a0", "#8b74bb", "#171b37"],
  culture: ["#8e492d", "#d49b50", "#301b17"],
  festivals: ["#a42d47", "#f18a31", "#321520"],
  famille: ["#367d68", "#e9ba5b", "#172a21"],
  networking: ["#326080", "#8c6d9f", "#1b1e31"],
};

function asRecord(value: Json | undefined): Record<string, Json | undefined> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function asString(value: Json | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: Json | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mapProgram(value: Json | undefined): ProgramStep[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((step) => {
    const record = asRecord(step);
    const time = asString(record?.time);
    const label = asString(record?.label);
    return time && label ? [{ time, label }] : [];
  });
}

function mapTiers(value: Json | undefined): TicketTier[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((tier) => {
    const record = asRecord(tier);
    const id = asString(record?.id);
    const name = asString(record?.name);
    const price = asNumber(record?.price);
    const quota = asNumber(record?.quota);
    const sold = asNumber(record?.sold);
    if (!name || price === null || quota === null || sold === null) return [];
    const perks = Array.isArray(record?.perks)
      ? record.perks.filter((perk): perk is string => typeof perk === "string")
      : [];
    return [{ id: id ?? undefined, name, price, quota, sold, perks }];
  });
}

export function mapPublicEvents(value: Json): Event[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const record = asRecord(row);
    if (!record) return [];
    const id = asString(record.id);
    const title = asString(record.title);
    const categoryId = asString(record.category);
    const date = asString(record.date);
    const time = asString(record.time);
    const venue = asString(record.venue);
    const address = asString(record.address);
    const district = asString(record.district);
    const organizerId = asString(record.organizer_id);
    const description = asString(record.description);
    const category = CATEGORIES.find((item) => item.id === categoryId);
    const tiers = mapTiers(record.tiers);
    if (!id || !title || !categoryId || !date || !time || !venue || !address
      || !district || !organizerId || !description || !category || tiers.length === 0) {
      return [];
    }

    const posterUrl = asString(record.poster_url);
    const organizerName = asString(record.organizer_name) ?? "Organisateur";
    const latitude = asNumber(record.latitude) ?? 6.1319;
    const longitude = asNumber(record.longitude) ?? 1.2228;
    const program = mapProgram(record.program);
    const featured = record.featured === true;
    const trending = record.trending === true;
    const isNew = record.is_new === true;
    const free = record.free === true;
    const organizerVerified = record.organizer_verified === true;

    return [{
      id,
      title,
      category: categoryId,
      date,
      time,
      venue,
      address,
      district,
      organizerId,
      organizerName,
      organizerVerified,
      description,
      program,
      tiers,
      featured,
      trending,
      isNew,
      free,
      poster: POSTER_COLORS[categoryId] ?? POSTER_COLORS.concerts,
      posterUrl,
      emoji: category.emoji,
      latitude,
      longitude,
    }];
  });
}
