# SNIFFIN // Peak PvM

Production-oriented static frontend and Cloudflare Worker API for `https://peakpvm.com/sniffin/`.

## What is automated

- Live total boss KC from Wise Old Man's public `latestSnapshot.data.bosses` metrics (updated when Wise Old Man has a new snapshot; this is not direct game telemetry).
- Frontend auto-refreshes boss KC every 5 minutes; backend caches responses for roughly 4 minutes.
- Current hunt KC, probability-by-KC, vault boss-KC captions, collection counts, and site dashboard calculations update automatically from these metrics and owner-saved state.
- Statistics calculator supports custom drop rate and number of rolls.

## What must be entered manually

- Which pet you own, the kill count you received it at, the currently selected hunt, field notes, hunt start KC, and optional manually tracked KC for content not supplied by WOM, and drop rate overrides in the owner console.
- Boss and activity drop rates are a curated starting catalog, not a guaranteed accurate list for every method. The app does **not** automatically detect pet drops.
- No fake live GP/hour, kills/hour, or drop notifications are advertised.

## Deploy (Cloudflare + static site)

1. Copy `sniffin/` to the `sniffin/` directory in the existing `osrssniffin/peakpvm-site` repository and publish the existing site. This is the standalone page at `/sniffin/`. It assumes the site is served under `peakpvm.com` with Cloudflare proxying requests.
2. In your Cloudflare account create a KV namespace named `SNIFFIN_KV` and paste its namespace ID into `worker/wrangler.toml`.
3. In `worker/`, run `npx wrangler login` and then:

   ```sh
   npx wrangler secret put ADMIN_PIN
   # When prompted, enter the requested PIN (do not commit it to GitHub).
   npx wrangler secret put SESSION_SECRET
   # When prompted, enter a long, random, independent secret (32+ bytes).
   npx wrangler deploy
   ```

4. Confirm the route `peakpvm.com/sniffin/api/*` points to this Worker. If your deployment is on Cloudflare Pages instead, adapt the backend as a Pages Function or route the Worker explicitly; a GitHub Pages website by itself cannot securely store shared edits or enforce IP/PIN login.
5. Test public page in private browsing, then test Edit using the allowlisted public IP. **The IP may change, and some ISPs route traffic through different egress addresses.** Update `ALLOWED_IP` in the Worker when necessary and redeploy.
6. If you want a specific OSRS account tracked, set its exact character name in the editor. The default `Sniffin` is only a placeholder until verified. If WOM has not tracked your account recently, use Wise Old Man's Update Player feature to collect a fresh snapshot.

## Security notes

- Admin editor link is only displayed to the allowlisted IP according to the Cloudflare request's `CF-Connecting-IP`. **Every login and state mutation is independently server-gated**, not just hidden in the browser. A secret PIN is additionally required.
- Store the PIN using `wrangler secret put ADMIN_PIN`. Never put the PIN or `SESSION_SECRET` in the public source, HTML, JavaScript, or a committed Wrangler vars section. Because this was requested with a PIN shared in chat, changing it to a new strong passphrase is recommended before production.
- Successful auth uses a signed, HttpOnly, Secure, SameSite=Strict cookie lasting 45 minutes and bound to the allowlisted IP. Failed PIN attempts are KV-rate-limited (6 failed attempts per 15 minutes; KV is eventually consistent and is not a robust distributed rate limiter).
- Public content is readable; edits require owner IP plus valid login. A static-only HTML deployment **cannot** offer this protection.
- KV is eventually consistent: owner edits may briefly appear stale to other visitors. If strong consistency or immediate coordination becomes necessary, move state to a Durable Object or D1.
- Use Cloudflare WAF rate limiting for the `/sniffin/api/auth/login` endpoint for stronger protection. Consider Cloudflare Access for a stronger primary authentication flow.

## Files

- `sniffin/index.html`: the public UI and edit console
- `sniffin/styles.css`: full responsive design
- `sniffin/app.js`: pet catalog, live WOM sync, calculator, edit controls
- `worker/index.js`: authenticated JSON API, state storage and WOM proxy
- `worker/wrangler.toml`: Worker routing and KV configuration

### Limitations to check when customizing

- OSRS content changes frequently. This curated pet catalog is intentionally *not* presented as a verified complete list. Some pet rates vary by source/method and may change. Verify exact drop rates against the OSRS Wiki before treating them as authoritative.
- Some Wiki item images may return a missing file (e.g. pets with different item-name conventions); the UI degrades gracefully. Update the image names as needed.
- Shared pets that drop from multiple bosses are represented once in the vault; the associated KC comes from the main listed source.
- For a stronger fully automatic collection log, you would need to build and authorize a RuneLite plugin integration; WOM alone cannot prove pet ownership.
