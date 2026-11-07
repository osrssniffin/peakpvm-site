(() => {
  'use strict';
  // This is a browser-side convenience gate on a public static site, not server authentication.
  const PIN_DIGEST = '797b59d2942a9118ea3d4cb78eae60a64271b609207f99594ee76b9f57b9944a';
  const SESSION_KEY = 'peakpvm-ge-pin-session-v1';
  const gate = document.getElementById('pinGate');
  const guide = document.getElementById('guide');
  const form = document.getElementById('pinForm');
  const input = document.getElementById('pinInput');
  const button = document.getElementById('pinSubmit');
  const message = document.getElementById('pinMessage');
  let unlocked = false, checking = false;

  function focusPin() {
    if (!unlocked) input.focus({ preventScroll: true });
  }
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    input.value = '';
    gate.hidden = true;
    guide.hidden = false;
    guide.inert = false;
    const script = document.createElement('script');
    script.src = './app.js?v=20261107-2';
    document.body.appendChild(script);
    guide.tabIndex = -1;
    guide.focus({ preventScroll: true });
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (checking || unlocked) return;
    const pin = input.value; // Keep it as a string: leading zeroes are significant.
    if (!/^[0-9]{4}$/.test(pin)) {
      message.textContent = 'Enter a four-digit PIN.';
      focusPin();
      return;
    }
    checking = true;
    button.disabled = true;
    message.textContent = '';
    try {
      const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
      const digest = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
      if (digest !== PIN_DIGEST) {
        message.textContent = 'Incorrect PIN. Try again.';
        input.value = '';
        focusPin();
        return;
      }
      try { sessionStorage.setItem(SESSION_KEY, 'unlocked'); } catch { /* Unlock still works if storage is blocked. */ }
      unlock();
    } catch {
      message.textContent = 'Unable to check the PIN. Please reload and try again.';
      focusPin();
    } finally {
      checking = false;
      button.disabled = false;
    }
  });
  input.addEventListener('input', () => { message.textContent = ''; });
  window.addEventListener('pageshow', focusPin);
  try {
    if (sessionStorage.getItem(SESSION_KEY) === 'unlocked') unlock();
  } catch { /* Without storage, each visit needs the PIN. */ }
  focusPin();
})();
