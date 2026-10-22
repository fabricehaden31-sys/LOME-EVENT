export function formatFCFA(amount: number): string {
  return `${amount.toLocaleString("fr-FR").replace(/\u202f/g, " ")} FCFA`;
}

export function formatDateFR(dateISO: string): string {
  const d = new Date(dateISO + "T12:00:00");
  return d
    .toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    .replace(/^./, (c) => c.toUpperCase());
}

export function formatDateShortFR(dateISO: string): string {
  const d = new Date(dateISO + "T12:00:00");
  return d
    .toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
    .replace(".", "");
}

export function dayMonthUpper(dateISO: string): string {
  const d = new Date(dateISO + "T12:00:00");
  return d
    .toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
    .toUpperCase();
}

export function isWeekend(dateISO: string): boolean {
  const day = new Date(dateISO + "T12:00:00").getDay();
  return day === 5 || day === 6 || day === 0;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
