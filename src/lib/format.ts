// Display helpers. All dates are shown as DD-MM-YYYY in Indian Standard Time
// and amounts in Indian grouping (1,00,000), as the spec requires.

const IST = "Asia/Kolkata";

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  // Plain dates ("2026-11-27") are calendar dates: show them as-is.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}-${m}-${y}`;
  }
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")}`;
}

export function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
}
