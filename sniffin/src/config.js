/* Keep configuration separate so Codex can remove local testing cleanly. */
window.SNIFFIN_CONFIG = {
  PLAYER: 's niffin',
  DEFAULT_TARGET: 'sarachnis',
  // Optional shared Cloudflare Worker URL; blank = browser-only changes.
  TARGET_API_URL: '',
  TEST_MODE: false, // Local tester writes true in its own copy; never commit true to GitHub.
  DIRECT_TEMPLE: true,
  SNAPSHOT_PATH: './data/live.json',
  REFRESH_MS: 15 * 60 * 1000
};
