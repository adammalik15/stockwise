export function formatMarketCap(v?: number | null) {
  if (!v) return 'N/A';
  if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  return '$' + v.toLocaleString();
}

export function formatPercent(v?: number | null) {
  if (v == null) return 'N/A';
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

export function formatPrice(v?: number | null) {
  if (v == null) return 'N/A';
  return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}