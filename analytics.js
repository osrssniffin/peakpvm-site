(() => {
  if (location.pathname.startsWith("/admin")) return;

  const VISITOR_KEY = "peakpvm_visitor_id";
  const SESSION_KEY = "peakpvm_session";
  const SESSION_TIMEOUT = 30 * 60 * 1000;

  function id() {
    return crypto.randomUUID();
  }

  let visitorId = localStorage.getItem(VISITOR_KEY);
  if (!visitorId) {
    visitorId = id();
    localStorage.setItem(VISITOR_KEY, visitorId);
  }

  let session;
  try {
    session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
  } catch {
    session = null;
  }

  const now = Date.now();
  if (!session || !session.id || !session.lastSeen || now - session.lastSeen > SESSION_TIMEOUT) {
    session = { id: id(), lastSeen: now };
  } else {
    session.lastSeen = now;
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

  const payload = {
    path: location.pathname,
    referrer: document.referrer || "",
    visitorId,
    sessionId: session.id,
  };

  fetch("https://peakpvm-analytics.bells-pvm.workers.dev/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    keepalive: true,
    body: JSON.stringify(payload),
  }).catch(() => {});
})();
