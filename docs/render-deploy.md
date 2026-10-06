# Render Deployment

## Deployment Shape

[render.yaml](../render.yaml) defines three resources in the same Render region:

| Resource | Purpose |
| --- | --- |
| `ever-after` | Public Node.js 24 service running the production Next.js build |
| `ever-after-api` | Private Python 3.11 service running Gunicorn and Django |
| `ever-after-db` | PostgreSQL 17 with external database access disabled |

The API has a 5 GB persistent disk mounted at `/var/data`; uploads live in `/var/data/media`. The browser reaches Django only through Next.js `/api/` rewrites. Never expose that disk through a public static-file route or move private API images into an image CDN.

**This is a paid deployment.** Private services, persistent disks, the selected web service, and the database are not a free-only setup. Review Render's current estimate before creating the Blueprint. This repository does not provision services merely by being pushed to GitHub.

## Create the Blueprint

1. In GitHub, confirm the `CI` workflow for the intended `main` commit is green. If Actions are disabled, enable them and run the workflow before deploying.
2. In Render, choose **New > Blueprint**, connect `AmalJerry/ever_after`, select `main`, and use the root `render.yaml` file.
3. Review the plans, region, persistent disk, and database. Enter `PUBLIC_SITE_URL` as the exact expected public frontend HTTPS origin, without a path, for example `https://your-service-name.onrender.com`. Do not copy that example literally or use the private API hostname.
4. Create the resources. Render generates the Django secret and supplies the private API address and PostgreSQL connection string. Do not put these values in GitHub or source files.
5. Check the frontend's actual assigned public URL. If Render adds a suffix or assigns a different hostname, update `PUBLIC_SITE_URL` on **ever-after-api** to that exact origin and redeploy the API before using the studio.
6. Confirm both services are healthy and complete the smoke checks below before distributing private links.

The first deployment creates an empty production database. Your ignored local SQLite database, accounts, stories, uploads, and environment files are not uploaded. Any migration of existing private data is a separate, explicit operation requiring a backup and a validated media copy.

## Configuration

| Variable | Service | Value |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | API | Exact public HTTPS frontend origin; entered during Blueprint setup |
| `DJANGO_DEBUG` | API | `false`; Render startup rejects development mode |
| `DJANGO_SECRET_KEY` | API | Generated once by Render; keep stable across deploys |
| `DATABASE_URL` | API | Blueprint-managed private PostgreSQL connection string |
| `DJANGO_MEDIA_ROOT` | API | `/var/data/media`, on the persistent disk |
| `DJANGO_INTERNAL_HOST` | API | Blueprint-managed private hostname, added to allowed hosts |
| `DJANGO_TRUST_PROXY` | API | `true`, only behind the controlled private Render/Next proxy |
| `DJANGO_API_HOSTPORT` | Frontend | Blueprint-managed API host and port; read at build time |

`DJANGO_API_ORIGIN` overrides `DJANGO_API_HOSTPORT`; leave it unset on Render unless intentionally changing the architecture. Never leave a localhost API origin in the production frontend. Rebuild the frontend after changing either value because Next.js rewrites are compiled into the build.

For a custom domain, attach it to the **frontend**, finish its HTTPS setup, and change the API's `PUBLIC_SITE_URL`. If multiple public origins must remain active, set `DJANGO_CSRF_TRUSTED_ORIGINS` to a comma-separated list of their exact HTTPS origins. Do not use wildcards or disable CSRF. The API stays private; allowed API hosts and trusted browser origins serve different purposes.

Do not change the generated secret casually: rotating it invalidates existing sessions. Production cookies are secure, HTTP-only, and SameSite=Lax. The trusted HTTPS header must be provided by the controlled proxy, not an arbitrary publicly reachable backend.

## Build and Startup

- The frontend uses `npm ci --include=dev` and `npm run build`, then `next start` on Render's assigned port.
- The API installs pinned runtime requirements. [backend/predeploy.sh](../backend/predeploy.sh) runs migrations, creates the shared database cache table, and runs `check --deploy --fail-level WARNING`.
- Render mounts disks at runtime, not during build/predeploy. [backend/start.sh](../backend/start.sh) creates the media directory after mounting and starts Gunicorn.
- The public `/api/health/` endpoint reaches Django and performs a database query. It returns a sanitized 503 if the database is unavailable. It does not check disk capacity or replace functional monitoring.
- A persistent disk ties the API to one service instance and prevents zero-downtime replacement. Expect brief API interruptions during redeploys. Do not scale instances without moving private media to appropriate shared storage.
- Subsequent deployments use `autoDeployTrigger: checksPass`. Do not bypass failing CI to publish an update.

Gunicorn access logs contain only the method, status, and duration, not request paths or queries. Share tokens are secrets embedded in paths and media queries. Review Render/edge request logs and retention separately; do not enable URL logging or external analytics that captures private links or message content.

## Smoke Checks

Run these manually on the final public HTTPS domain, not a localhost preview:

1. Open `/api/health/`; expect HTTP 200 and `{"status":"ok"}`. Open `/` and `/studio` and verify bundled images and fonts load.
2. Create a disposable account, sign out, and sign in again. Save and reload a draft. Confirm session and CSRF cookies are Secure and HttpOnly and that no CSRF or redirect-loop errors occur.
3. Upload an owned photograph and a small animated image. Preview them, including reduced-motion stills. Publish and open the link in a separate private browser window without signing in.
4. Confirm unpublished edits do not alter the published story. Revoke the link and verify both the story and previously copied protected media URLs are unavailable in that private window. Delete the test story afterward.
5. Test on iOS Safari and Android Chrome: microphone permission, denial fallback, backgrounding, a real blow in a noisy room, after-candle music, replay, long text, and a small viewport. Synthetic Chromium tests cannot certify real microphone accuracy or every mobile audio policy.
6. Redeploy once with a disposable story present and verify its database record and uploaded media survive. Then delete it. Confirm you can restore both the database and corresponding private files from a backup.

Never run the automated browser suite against production. It creates test accounts and modifies stories. Use a disposable test database and media directory instead.

## Operations and Limits

- Configure database and disk backups, retention, disk-capacity alerts, availability/error monitoring, and a tested restore procedure before relying on the service for irreplaceable content. Database backups do not include uploaded files. Per-account quotas do not cap total disk usage across all accounts.
- The production database cache shares throttle state across Gunicorn threads/workers. DRF throttles are best-effort application limits, not a DDoS defense. Anonymous clients conservatively share the internal proxy's address budget (`NUM_PROXIES=0`); configure and verify edge rate limits/client-IP handling for a broader public launch rather than trusting arbitrary forwarded headers.
- Next limits proxied bodies to 55 MB, and Django validates per-file limits and storage quotas. Review hosting/edge request limits as well. Audio/video signatures are checked, but malware scanning, transcoding, timed subtitles, and transcripts are not implemented.
- There is no self-service account recovery or email verification. Establish a support policy before accepting general public registrations. Decide on privacy terms, deletion/retention rules, and a deployment-specific Content Security Policy appropriate to the intended audience.
- Private links are bearer credentials. Anyone with a link can access its published content while valid; revocation cannot recall files already downloaded or captured.
- Confirm distribution rights for the supplied GIFs and review the sample photograph/font licenses before a public launch. See [sample asset provenance](../README.md#sample-assets). Do not include personal media in the public repository.

## Dependency Checks

CI audits Python runtime requirements and `npm audit --omit=dev --audit-level=moderate`. At the October 6, 2026 preparation check, both runtime audits were clean after updating Next.js and Django REST Framework. Dependabot tracks later updates; rerun audits rather than treating this as a permanent guarantee.

The full npm audit still reports a development-only `braces` advisory, `GHSA-vfj7-8cjw-p6xm`, through `eslint-config-next` / `fast-glob` / `micromatch` (five dependency-chain entries). No compatible upstream fix was available at that check. It is not in the production dependency graph, but development packages are installed to build and lint. CI uses trusted repository configuration, read-only GitHub permissions, and no production credentials. Do not downgrade the patched framework with `npm audit fix --force` just to clear this report; track the upstream fix and reassess the risk when accepting untrusted build inputs.

The [CI workflow](../.github/workflows/ci.yml) also tests PostgreSQL migrations, production configuration, Gunicorn configuration on Linux, frontend lint/build/types, and the browser/signal suite. Local Windows tests use SQLite; a passing local run alone does not verify PostgreSQL or Gunicorn on Render.