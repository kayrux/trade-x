// Formatting + small derivations shared by the Portfolio and Account Details
// pages. Kept here (not in lib/utils, per the folder rule) since it's page-local.

export const RANGES = ['1W', '1M', '3M', '6M', 'YTD', '1Y', 'ALL'];

// Suffix under the header change figure, phrased for the selected range. This is
// a change in market value over the window (which includes deposits), not a pure
// time-weighted return — worded neutrally to avoid overclaiming.
export function rangeSubtitle(range) {
  switch (range) {
    case '1W': return 'past week';
    case '1M': return 'past month';
    case '3M': return 'past 3 months';
    case '6M': return 'past 6 months';
    case 'YTD': return 'this year';
    case '1Y': return 'past year';
    case 'ALL': return 'all time';
    default: return '';
  }
}

const moneyFmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return '—';
  return `$${moneyFmt.format(n)}`;
}

export function formatSignedMoney(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return '—';
  const sign = n < 0 ? '−' : '+';
  return `${sign}$${moneyFmt.format(Math.abs(n))}`;
}

export function formatPercent(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return '—';
  const sign = n < 0 ? '−' : '+';
  return `${sign}${Math.abs(n).toFixed(2)}%`;
}

export function formatQty(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return '—';
  return String(Number(n.toFixed(6)));
}

// up / down / flat, for the pos/neg color classes.
export function changeClass(val) {
  const n = Number(val);
  if (!Number.isFinite(n) || n === 0) return 'flat';
  return n > 0 ? 'up' : 'down';
}

// Change over a value series: last vs first point. Returns null when there's
// nothing to compare or the baseline is zero.
export function seriesChange(series) {
  if (!series || series.length < 2) return null;
  const first = Number(series[0].value);
  const last = Number(series[series.length - 1].value);
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) return null;
  const abs = last - first;
  return { abs, pct: (abs / first) * 100 };
}
