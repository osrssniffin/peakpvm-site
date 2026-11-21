/* Keep configuration separate so Codex can remove local testing cleanly. */
window.SNIFFIN_CONFIG = {
  PLAYER: 's niffin',
  DEFAULT_TARGET: 'sarachnis',
  // Server-side shared target, PIN verification, and Temple sync.
  TARGET_API_URL: 'https://peakpvm-sniffin-api.bells-pvm.workers.dev/sniffin/api',
  TEST_MODE: false, // Local tester writes true in its own copy; never commit true to GitHub.
  DIRECT_TEMPLE: false,
  SNAPSHOT_PATH: './data/live.json',
  REFRESH_MS: 15 * 60 * 1000
};
