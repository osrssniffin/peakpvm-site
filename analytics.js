(() => {
  if (location.pathname === "/admin" || location.pathname.startsWith("/admin/")) return;
  if (window.__peakpvmAnalyticsInstalled) return;
  window.__peakpvmAnalyticsInstalled = true;

  const VISITOR_KEY = "peakpvm_visitor_id";
  const SESSION_KEY = "peakpvm_session";
  const SESSION_TIMEOUT = 30 * 60 * 1000;
  let lastSentPath = null;

  function id() { return crypto.randomUUID(); }
  function normalizedPath() {
    const path = location.pathname || "/";
    return path === "/" ? "/" : path.replace(/\/+$/, "") + "/";
  }

  let visitorId = localStorage.getItem(VISITOR_KEY);
  if (!visitorId) {
    visitorId = id();
    localStorage.setItem(VISITOR_KEY, visitorId);
  }

  function trackCurrentRoute() {
    if (location.pathname === "/admin" || location.pathname.startsWith("/admin/")) return;
    const path = normalizedPath();
    if (lastSentPath === path) return;
    lastSentPath = path;

    let session;
    try { session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch { session = null; }
    const now = Date.now();
    if (!session || !session.id || !session.lastSeen || now - session.lastSeen > SESSION_TIMEOUT) {
      session = { id: id(), lastSeen: now };
    } else {
      session.lastSeen = now;
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

    fetch("https://peakpvm-analytics.bells-pvm.workers.dev/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify({
        path,
        referrer: document.referrer || "",
        visitorId,
        sessionId: session.id,
      }),
    }).catch(() => {});
  }

  trackCurrentRoute();
  addEventListener("popstate", trackCurrentRoute);
  for (const method of ["pushState", "replaceState"]) {
    const original = history[method];
    history[method] = function(...args) {
      const result = original.apply(this, args);
      queueMicrotask(trackCurrentRoute);
      return result;
    };
  }
})();
