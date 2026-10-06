# Ever, after. Architecture and MVP

## Scope and journeys

The MVP is a private birthday story, not a public social network. A creator registers or signs in, edits names, a date, memories, a letter, cake settings, a question reveal, and optional licensed audio, previews the draft, then publishes and copies a revocable link. A recipient opens that link without an account directly at the cake. A completed wish unlocks a GIF celebration, an interactive 3D heart, ordered memories, a letter, and one final chapter combining the optional surprise with the closing dedication. The final heading and hug GIF remain present whether or not a surprise is configured; revealing the answer does not navigate to another chapter. A clearly separate manual fallback is offered after microphone denial, errors, or timeout.

The home route is a fully interactive, explicitly labeled sample. `/studio` is the creator workspace. `/experience/[token]` is the published recipient experience. Account recovery, payments, collaborative editing, video transcoding, and motion-sensor effects are outside the initial scope. Device tilt adds little to this workflow and is deliberately deferred.

## System

- Next.js App Router, React, TypeScript, Tailwind CSS, Three.js, Framer Motion, Lucide icons, and canvas-confetti.
- Django REST Framework, Django session authentication, SQLite locally, PostgreSQL through environment configuration for deployment.
- The Next.js `/api/*` rewrite targets Django. Browsers use one origin; HTTP-only session cookies and CSRF protection avoid storing credentials in localStorage.
- An Experience belongs to one Django User. Structured, serializer-validated JSON holds the ordered story. A separate published JSON snapshot prevents draft edits from leaking into the shared experience. A MediaAsset belongs to both an owner and an experience.
- Share tokens contain 256 bits of cryptographic randomness. A public token grants access only to that published snapshot and the media it references. Unpublishing revokes access. Tokens are bearer secrets: anyone with the link can view it.
- Uploads are never served by a public static media directory. Owner sessions or a valid matching published token authorize media reads. Images are verified, resized, stripped of metadata, and encoded as WebP. GIF/animated WebP uploads retain their frames and generate a private first-frame WebP. The animation and still are authorized independently against the published references. Videos and audio are size-, MIME-, extension-, and signature-checked, but not transcoded or malware-scanned in this MVP.

## API contract

All endpoints use JSON except multipart uploads. Authenticated mutations require a session and `X-CSRFToken`. Validation errors return HTTP 400 with field errors; authentication failures return 403; missing, expired, revoked, and inaccessible resources return 404; throttling returns 429. Draft routes never return another creator's objects.

| Method | Path | Access | Request | Response |
| --- | --- | --- | --- | --- |
| GET/HEAD | `/api/health/` | Anyone | None | Database-backed 200 `{status: "ok"}` or sanitized 503 `{status: "unavailable"}`; no-store |
| GET | `/api/session/` | Anyone | None | `{user: {id, username} or null, csrfToken}` |
| POST | `/api/register/` | CSRF, anonymous allowed | `{username, password}`; username 3-150 chars, Django password validators | 201 `{user}` and session cookie |
| POST | `/api/login/` | CSRF, anonymous allowed | `{username, password}` | 200 `{user}` and session cookie |
| POST | `/api/logout/` | CSRF | `{}` | 204 |
| GET | `/api/experiences/` | Owner | None | Owner's `{id, draft, publishedAt, shareToken, expiresAt, updatedAt}[]` |
| POST | `/api/experiences/` | Owner | `{draft: ExperienceContent}` | 201 owner representation |
| GET/PATCH/DELETE | `/api/experiences/{uuid}/` | Owner | PATCH: `{draft: ExperienceContent}` | 200 owner representation / 204 |
| POST | `/api/experiences/{uuid}/publish/` | Owner | `{expiresInDays: 7 or 30 or 90}` | Validated snapshot and owner representation |
| POST | `/api/experiences/{uuid}/unpublish/` | Owner | `{}` | Revoked snapshot and owner representation |
| POST | `/api/experiences/{uuid}/media/` | Owner | multipart `file`, `kind: image or video or audio` | 201 `{id, url, stillUrl, kind, name}` |
| GET | `/api/shared/{token}/` | Valid bearer link | None | Published `ExperienceContent`, authorized media URLs |
| GET | `/api/media/{uuid}/` | Owner or `?share={token}` | Optional byte Range | Private media response; no-store; nosniff |
| GET | `/api/media/{uuid}/still/` | Owner or matching published `?share={token}` | Optional byte Range | Private normalized static WebP; 404 if absent or unreferenced |

`ExperienceContent` is defined in `frontend/src/lib/types.ts` and mirrored by nested DRF serializers. Names, text, dates, theme and cake choices, unique memory IDs, array lengths, sensitivity, and asset ownership are validated server-side. Arbitrary remote media URLs and HTML are not accepted. Personal text is rendered as plain React text, never injected HTML.

## Presentation Contract

`ExperienceContent.presentation` is stored inside both draft and published JSON. It is optional for old clients/records and populated with compatible defaults on reads and validated writes. Unknown top-level or presentation keys return field errors rather than silently disappearing. Publishing snapshots the validated content, including resolved defaults; later drafts do not alter a live snapshot.

| Setting | Validation / Meaning |
| --- | --- |
| `accentColor` | Six-digit hex color; no raw CSS accepted |
| `showBirthday`, `showCover` | Show saved birthday date or owner-selected background photograph |
| `animationsEnabled` | Creator motion preference; system reduced motion always takes priority |
| `musicEnabled`, `musicAutoplay`, `musicVolume` | Availability, after-candle playback, finite 0-1 initial gain |
| `chapters` | Boolean flags for celebration, heart, memories, letter |
| `chapterOrder` | Exact permutation of those four chapter IDs; no duplicates or arbitrary routes |
| `copy` | Typed story wording fields; 40-character action labels, 100-character headings/labels, 200-character messages/notes; required headings/buttons cannot be blank |
| `celebrationMedia`, `finaleMedia` | `{url, stillUrl, alt}`; same-owner/same-experience image assets or approved built-in artwork; matching static fallback required for animations |

The candle and finale cannot be disabled or moved. Empty/disabled memories are omitted from navigation. Visible incomplete memories block publishing, while disabled ones can remain unfinished in the draft. Memory items may include `stillUrl` for animated uploads. Application permission explanations, error recovery, and security controls are not creator-authored.

Frontend normalization and defaults are centralized in `frontend/src/lib/presentation.ts`; backend defaults and strict validation are in `backend/stories/serializers.py`. Both are verified by round-trip and legacy-record tests. The studio updates its saved state from the canonical server response. The `0002_mediaasset_still_file` migration stores reduced-motion files on the existing MediaAsset ownership boundary.

## Interaction and visual system

The finale's configured surprise result is rendered only after a form submission containing a non-whitespace response (maximum 500 characters). The Send action is disabled until input is present; a submit handler independently checks trimmed input, supports Enter, and focuses the result region. Reply state is ephemeral and resets on replay/reload. No API call or reply storage is added. This is not an answer-verification or authorization mechanism; the result is already in the authorized published payload.

A fixed-viewport recipient state machine replaces the scrolling website. The default palette is based on #F97BA3; theme presets/custom accents affect the page palette and 3D heart, while the private cover background is opt-in. Cormorant Garamond supplies display typography; DM Sans keeps controls readable. No scroll or swipe advances a chapter, and the first chapter cannot be skipped with navigation. Enabled chapters follow saved order, with memories and letters paginated within measured space. The studio exposes all story presentation settings while retaining its focused editing layout.

Blow Candles is the microphone control; there is no separate mic icon or studio link on the recipient screen. Permission is requested only after that explicit action and the adjacent explanation. Browsers do not allow default permission to be granted by a website; remembered permission may avoid a subsequent browser prompt. A short ambient calibration precedes an RMS-plus-broadband, sustained-window heuristic. This is not a reliable classifier of human blowing; speech, wind, and music may trigger it. Sensitivity is configurable. No samples are uploaded or retained. All streams, animation loops, audio contexts, and timeouts are released on completion, cancellation, timeout, or unmount. A manual recovery action is available after denial, unsupported APIs, errors, and timeout.

The 3D cake and heart use a lazy-loaded Three.js module, capped device pixel ratios, static shadow maps, software-GPU quality reduction, pointer response, and visibility-aware scheduling. Scene disposal releases GPU resources and listeners. Unsupported WebGL retains a CSS cake and icon-based heart. System reduced-motion preferences use static poses and a still frame of the locally supplied GIF; no animation pause/play control is displayed in any chapter. Music controls remain separate. The original 480px GIF is not described as HD.

The candle-button gesture prepares a silent Web Audio context when music is enabled. Candle extinguishing starts playback only if configured, at the saved gain (80% by default). Manual-start mode waits for Play. The built-in soundtrack is a locally synthesized music-box arrangement of the public-domain Happy Birthday melody. Uploaded audio takes precedence and uses a MediaElementAudioSourceNode through the same gain control. Both paths retain pause, mute, collapsed volume controls, and blocked-autoplay recovery; restarting stops playback and leaving disposes resources. Videos use controls, metadata-only preloading, and lazy presentation. No optional sensor or media permission blocks the experience.

Recipient previews run with `next start`, not `next dev`, so development issue badges are not shipped to the phone-facing page. Actual renderer warnings are fixed at source rather than suppressing browser errors or hiding the developer portal with CSS.

## Validation and deployment gates

Run focused signal tests, Django authorization/snapshot/upload tests, TypeScript, ESLint, and a production build. Exercise desktop and mobile layouts, keyboard dialogs, reduced motion, invalid links, creator editing, publishing, and candle fallback in a real browser. Synthetic microphone tests do not replace real iOS/Android and room-noise testing.

The [Render Blueprint](../render.yaml) runs production Next.js publicly and Gunicorn/Django privately in the same region as PostgreSQL and a persistent media disk. Predeploy runs migrations, creates the shared database cache table, and rejects Django deployment warnings. HTTPS proxy trust and exact public-origin CSRF configuration are mandatory; Render refuses development mode, ephemeral SQLite, missing storage, or a missing secret. The health route checks the database; private API media is excluded from the public image optimizer and Gunicorn URL logging.

The [deployment runbook](render-deploy.md) covers paid infrastructure, final-domain verification, backups, operational limitations, dependency advisories, and public-launch decisions. Application throttles are not edge abuse protection. Account recovery, malware scanning, and video processing remain outside this version's scope. Serve private media via authenticated internal redirects or short-lived signed storage URLs at scale. Development servers are never production infrastructure.