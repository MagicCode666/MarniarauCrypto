export function formatEur(value, forceDecimals) {
  if (value === undefined || value === null) return "—";
  const d = forceDecimals ?? (value < 1 ? 4 : 2);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: d,
  }).format(value);
}

export function formatLargeEur(value) {
  if (!value) return "—";
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)} B €`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)} Md €`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)} M €`;
  return formatEur(value);
}

export function formatDate(ts) {
  return new Date(ts * 1000).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}
