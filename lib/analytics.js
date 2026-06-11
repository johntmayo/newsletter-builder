// Thin wrapper around gtag so callers don't need to check whether GA is loaded
// (it isn't in dev without NEXT_PUBLIC_GA_MEASUREMENT_ID, and ad blockers can strip it).
export function trackEvent(name, params = {}) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, params);
}

// Fire-and-forget log to our own Supabase via /api/track-usage. Exact counts,
// unaffected by ad blockers. Failures are intentionally swallowed: usage
// logging must never break the builder for captains.
export function logUsage(event, { zone, itemsSelected, zoneUpdates, stylePreset } = {}) {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({ event, zone, itemsSelected, zoneUpdates, stylePreset });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track-usage", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/track-usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // ignore
  }
}
