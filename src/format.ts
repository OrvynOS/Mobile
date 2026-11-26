export const usd = (n: number | null | undefined, digits = 2) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits });

export const num = (n: number | null | undefined, digits = 4) => (n == null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: digits }));

export const pct = (ratio: number | null | undefined) => (ratio == null ? "—" : `${ratio >= 0 ? "+" : ""}${(ratio * 100).toFixed(2)}%`);

export const ago = (ms: number) => {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return `${Math.max(s, 0)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

export const short = (s: string, head = 8, tail = 6) => (s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s);

export const priceUsd = (n: number | null | undefined) => (n == null ? "—" : n >= 1 ? usd(n) : `$${n.toPrecision(3)}`);

export const STATUS: Record<string, string> = { live: "Live", awaiting_funds: "Needs funding", launching: "Launching", failed: "Launch failed" };

export const HIRE_STATUS: Record<string, { label: string; tone: "good" | "warn" | "bad" | "plain" }> = {
  awaiting_payment: { label: "Awaiting payment", tone: "warn" },
  funded: { label: "In progress", tone: "warn" },
  delivered: { label: "In review", tone: "good" },
  released: { label: "Completed", tone: "good" },
  refunded: { label: "Refunded", tone: "plain" },
  disputed: { label: "Disputed", tone: "bad" },
  resolved: { label: "Resolved", tone: "plain" },
  expired: { label: "Expired", tone: "plain" },
  invalid: { label: "Refunded", tone: "bad" },
};
