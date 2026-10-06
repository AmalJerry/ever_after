# Render Free Demo with SQLite

## Deployment Shape

[render.yaml](../render.yaml) defines two public web services on Render's Free compute plan:

| Resource | Purpose |
| --- | --- |
| `ever-after` | Node.js 24 running the production Next.js build |
| `ever-after-api` | Python 3.11 running Gunicorn, Django, and a local SQLite file |

There is no managed database or persistent disk. The API writes SQLite to `/tmp/ever-after/db.sqlite3` and uploads to `/tmp/ever-after/media`. The browser still uses same-origin `/api/` requests; Next.js proxies them to the backend's public HTTPS address. Free web services cannot receive private-network traffic, so do not use an internal hostname or `DJANGO_API_HOSTPORT` for this setup.

**This is a disposable demo, not durable hosting. Expect saved accounts, sessions, stories, share links, and uploads to be lost when the backend sleeps, restarts, or redeploys.** A path under `/tmp` does not provide persistent storage. Do not use this profile for irreplaceable birthday content or promise that published links will survive until their configured expiry.

Render's [free-service limits](https://render.com/docs/free) also apply: services sleep after inactivity, cold starts can take about a minute, and the two services share the workspace's free instance-hour allowance. If both run continuously, they can exhaust that allowance. Bandwidth/build limits can suspend the service or incur charges under your account's billing settings. Review those settings before deploying. Changing this file does not cancel any paid resources you previously created.

## Create the Blueprint

1. In GitHub, confirm the `CI` workflow for the intended `main` commit is green. If Actions are disabled, enable them and run the workflow before deploying.
2. In Render, choose **New > Blueprint**, connect `AmalJerry/ever_after`, select `main`, and use the root `render.yaml` file.
3. Confirm both services use `free` and that no database, disk, or pre-deploy command is listed. Render generates the Django secret; do not copy secrets into GitHub or chat.
4. Enter `PUBLIC_SITE_URL` on the API as the expected public frontend HTTPS origin, and `DJANGO_API_ORIGIN` on the frontend as the expected public backend HTTPS origin. Neither may contain an `/api` path. These two values are specific to your services, not generated secrets.
5. Check the actual assigned service URLs. If Render adds a suffix or assigns different names, correct both values. Redeploy the API after changing `PUBLIC_SITE_URL`, and rebuild/redeploy the frontend after changing `DJANGO_API_ORIGIN`. Finish this before creating any stories, because backend redeploys can erase them.
6. Open the frontend URL and complete the smoke checks below. You can name the frontend `happy-birthday-ever-after` if that name is available; use its actual assigned URL in `PUBLIC_SITE_URL`.

Every fresh backend filesystem starts with an empty database. Your ignored local SQLite file, accounts, stories, media, and environment files are not uploaded or modified. Do not commit them to GitHub. A secure transfer of existing data would be a separate operation and would still not make the free service's storage persistent.

## Manual Backend Setup

If you are already on **New > Web Service**, these are the backend fields:

| Field | Value |
| --- | --- |
| Runtime | Python |
| Branch | `main` |
| Root Directory | `backend` |
| Compute plan | Free |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `bash start.sh` |
| Pre-Deploy Command | Leave empty |
| Health Check Path | `/api/health/` |
| Persistent disk | None |

Set these backend environment variables exactly, except for the generated secret and your assigned frontend URL:

| Key | Value |
| --- | --- |
| `DJANGO_DEBUG` | `false` |
| `DJANGO_SECRET_KEY` | Use Render's Generate button; keep the value private and stable |
| `DJANGO_TRUST_PROXY` | `true` |
| `DJANGO_ALLOW_EPHEMERAL_SQLITE` | `true` |
| `DJANGO_SQLITE_PATH` | `/tmp/ever-after/db.sqlite3` |
| `DJANGO_MEDIA_ROOT` | `/tmp/ever-after/media` |
| `PUBLIC_SITE_URL` | Your frontend's actual HTTPS origin, without a path or trailing slash |
| `PORT` | `10000` |
| `WEB_CONCURRENCY` | `1` |
| `GUNICORN_CMD_ARGS` | Leave empty |

**Remove `DATABASE_URL` and `DJANGO_INTERNAL_HOST` from the backend form.** Do not enter `db.sqlite3` or `sqlite:///...` as a database URL. SQLite uses `DJANGO_SQLITE_PATH`. Render automatically provides its public backend hostname, which Django adds to allowed hosts. Do not import the local development environment file into Render or set `DJANGO_DEBUG=true`.

## Manual Frontend Setup

Create a second **Web Service** from the same repository:

| Field | Value |
| --- | --- |
| Runtime | Node |
| Branch | `main` |
| Root Directory | `frontend` |
| Compute plan | Free |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm run start -- --hostname 0.0.0.0 --port $PORT` |
| Health Check Path | `/` |
| `DJANGO_API_ORIGIN` environment variable | Actual backend public HTTPS origin, without `/api` or a trailing slash |
| `NEXT_TELEMETRY_DISABLED` environment variable | `1` |

Remove any old `DJANGO_API_HOSTPORT` or localhost API value from the frontend environment. Next.js compiles API rewrites during its build, so changing the API origin requires a rebuild. No browser CORS configuration is needed: browser API requests remain on the frontend origin.

For a custom domain, attach it to the frontend, finish HTTPS setup, and update the backend's `PUBLIC_SITE_URL`. For additional active frontend origins, set `DJANGO_CSRF_TRUSTED_ORIGINS` to their exact comma-separated HTTPS origins. Never use wildcards or disable CSRF. The secret remains required, and secure HTTP-only cookies are preserved even in this disposable setup.

## Build and Startup

- [backend/start.sh](../backend/start.sh) creates the database/media directories, warns about temporary storage, calls [backend/predeploy.sh](../backend/predeploy.sh) to migrate and create the cache table, checks deployment security, and then starts Gunicorn.
- Database setup runs at startup, not during the build or a Render pre-deploy hook. An existing SQLite file is not deliberately deleted; a fresh Render instance can nevertheless discard that file and start empty.
- The API's `/api/health/` endpoint performs a database query and returns a sanitized 503 when unavailable. The frontend health check uses `/` so its sample can load independently of an API cold start.
- Keep a single Gunicorn worker. SQLite uses a 20-second lock timeout, but concurrent writes can still contend; this is a small demo configuration, not a scalable database service.
- Subsequent deployments use `autoDeployTrigger: checksPass`. Do not bypass failing CI to publish an update.

Gunicorn access logs omit request paths and queries because share tokens are secrets. Review Render/edge request logging separately. Do not enable analytics that captures private links or messages. Authorized media endpoints and the image-optimizer restrictions remain in place; the API being publicly reachable does not grant access to drafts or uploads.

## Smoke Checks

Run these manually on the final public HTTPS domain, not a localhost preview:

1. Open the backend `/api/health/` and allow time for its cold start. Then open the frontend `/api/health/`; both should return HTTP 200 and `{"status":"ok"}`. A temporary proxy error while waking may require a retry.
2. Open `/` and `/studio` on the frontend. Register a disposable account, sign out/in, save a draft, and reload. Confirm there are no CSRF failures or redirect loops.
3. Upload an owned photo and small animation. Publish, open the link in a private browser window, and confirm unpublished edits remain private. Revoke it and verify the story and copied media URLs become unavailable. Delete the test story.
4. Test the real microphone, denied-permission fallback, after-candle music, replay, and small screens on iOS Safari and Android Chrome. Automated Chromium tests do not establish real-device microphone accuracy.
5. With only disposable data present, redeploy the backend and confirm it starts successfully with tables recreated as needed. Do not expect previous records or uploads to survive. Keep your original media elsewhere.

Never run the automated browser suite against a deployed site containing real stories. It creates accounts and modifies data. CI uses disposable databases and media directories.

## Operations and Limits

- Durable hosting requires a different storage plan. PostgreSQL remains supported through `DATABASE_URL`; a future paid deployment also needs persistent private media and backups. Remove the ephemeral opt-in when moving to that setup. This Blueprint provisions neither.
- DRF database-backed throttles are best-effort limits, not DDoS protection. Anonymous requests may share a proxy address budget (`NUM_PROXIES=0`). Do not blindly trust client-provided forwarding headers or disable throttles.
- Free backend restarts erase cache and session data along with stories. Expiry/revocation still applies while records exist, but it cannot prevent earlier data loss or recall already downloaded content.
- Next limits proxied bodies to 55 MB; application file limits and quotas still apply. Total storage usage across accounts is not capped. Audio/video signatures are checked, but malware scanning, transcoding, subtitles, and transcripts are not implemented.
- Account recovery and email verification are not implemented. Review privacy terms, monitoring, retention, and a suitable Content Security Policy before a broader launch.
- Confirm rights for the supplied GIFs, sample photos, and fonts; see [sample asset provenance](../README.md#sample-assets). Keep personal data out of Git.

## Dependency Checks

CI audits Python runtime requirements and `npm audit --omit=dev --audit-level=moderate`. At the October 6, 2026 preparation check, both runtime audits were clean after updating Next.js and Django REST Framework. Dependabot tracks later updates; rerun audits rather than treating this as a permanent guarantee.

The full npm audit still reports a development-only `braces` advisory, `GHSA-vfj7-8cjw-p6xm`, through `eslint-config-next` / `fast-glob` / `micromatch` (five dependency-chain entries). No compatible upstream fix was available at that check. It is not in the production dependency graph, but development packages are installed to build and lint. CI uses trusted repository configuration, read-only GitHub permissions, and no production credentials. Do not downgrade the patched framework with `npm audit fix --force` just to clear this report; track the upstream fix and reassess the risk when accepting untrusted build inputs.

The [CI workflow](../.github/workflows/ci.yml) tests both SQLite and PostgreSQL, deployment security, fresh SQLite startup and a second startup preserving an existing file, Gunicorn on Linux, frontend lint/build/types, and the browser/signal suite. The startup test does not claim that Render preserves a free instance's filesystem. Local Windows tests cannot verify the hosting platform's actual lifecycle.