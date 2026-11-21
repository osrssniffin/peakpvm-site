# AGENTS.md — PeakPvM Site

## Repository and production target

- Repository: `osrssniffin/peakpvm-site`
- Primary branch: `main`
- Production domain: `https://peakpvm.com/`
- Sniffin profile: `https://peakpvm.com/sniffin/`

## Core operating instructions

1. Work directly in the existing repository and current project workspace. The existing project is the source of truth.
2. Before editing, inspect only the files necessary to understand the requested change and the existing deployment configuration.
3. Use connected GitHub tools/API when available. Do not assume a terminal has a Git checkout, GitHub CLI (`gh`), or network access. If a shell cannot reach GitHub, try the authorized GitHub connector instead.
4. Never download, extract, rebuild, or recreate the entire project unless the requested change genuinely requires it.
5. Preserve existing styling, layout, integrations, hosting settings, and unrelated functionality.
6. Make the smallest practical change. Avoid unsolicited redesigns, refactors, feature additions, broad audits, and large dependency updates.
7. Never overwrite existing completed work with older, placeholder, test, or generated copies.
8. Do not request information that is already present in the repository or current task context.
9. For explicit production-deployment requests, perform the deployment using the existing verified workflow and configuration. Do not stop after merely describing how to deploy.
10. Do not claim that a deployment succeeded until there is evidence that production contains the intended changes.

## Sniffin page requirements

For changes under `/sniffin/`:

- Maintain the existing gold pet cards, current pet hunt display, TempleOSRS syncing, editor/PIN functionality, and responsive design.
- Preserve the site's existing hosting and routing configuration so the page works at `/sniffin/`, including its assets and any required subpath/base-path settings.
- Never publish offline-only controls, test fixtures, mock data, or development-only features.
- **Chance By This KC** means cumulative probability of obtaining the *selected pet*, using `P = (1 - (1 - 1/rate)^KC) * 100`. Do not include unrelated unique drops.
- **KC / Pet Rate** means selected boss KC followed by the selected pet's drop-rate denominator, e.g. `1,758 / 2,800`.
- Use verified, pet-specific rates for the correct boss or variant; show `—` when a reliable rate is unavailable.
- Do not add descriptive subtext beneath the four Current Pet Hunt statistics unless explicitly requested.

## Implementation and verification

- Identify the actual deployment mechanism from repository files (for example GitHub Actions, Cloudflare, or another configured host). Do not guess the deployment mechanism.
- Edit only necessary source files and retain existing project conventions.
- Run focused checks relevant to changed files and deployment. Avoid unnecessary full-project audits.
- Review the diff to ensure no unrelated files or secrets are included.
- Never commit credentials, API keys, tokens, or private environment values.
- Use the approved repository write path and the existing deployment process. A push to `main` is sufficient only when the configured host actually deploys from that push.
- Verify the deployment job where available and test the live target URL, including the specific behavior changed.
- If caching delays verification, distinguish an unverified live result from an actual deployment failure.

## Access and blockers

- GitHub connector access is preferred when available; local shell limitations do not establish that GitHub itself is inaccessible.
- If repository permissions, a missing project artifact, unavailable deployment credentials, or an actual service outage prevent completion, report the specific blocker and the minimum action necessary to resolve it.
- Do not fabricate deployment success, commits, URLs, workflow results, or file contents.
- Do not bypass repository protections or disable security checks merely to force a deployment.
- Never replace a production deployment with a local-only deliverable and claim the task is complete.

## Final response

When the task succeeds, respond briefly with the exact production URL, the commit or deployment reference if available, and confirmation of the requested change. If blocked, state precisely what failed and what is required. Avoid long explanations, repeated attempts that cannot succeed, and unrelated suggestions.
