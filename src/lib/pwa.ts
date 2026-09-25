/** Registers the app-shell worker in production only (never in preview/iframe). */
export function registerPWA() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;
  const host = window.location.hostname;
  let inIframe = false;
  try { inIframe = window.self !== window.top; } catch { inIframe = true; }
  const refused =
    inIframe ||
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    /(^|\.)lovableproject(-dev)?\.com$/.test(host) ||
    /(^|\.)beta\.lovable\.dev$/.test(host) ||
    new URLSearchParams(window.location.search).get("sw") === "off";
  if (refused) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
