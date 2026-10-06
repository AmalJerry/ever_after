# Ever, after.

A private couple birthday experience built from [Prompt.md](Prompt.md). The recipient opens a full-screen, cake-first celebration configured in `/studio`. Creators control the story text, media, colors, optional chapter order, music, cake, and surprise. The default theme remains rose-pink (`#F97BA3`), with expiring private links and separate draft/published snapshots.

## Recipient Journey

1. The opening screen contains the lit 3D birthday cake. There is no scrolling, swipe navigation, or link that skips ahead to later chapters.
2. **Blow Candles** activates microphone detection. A browser permission prompt appears if access has not already been granted. The button does not extinguish the candle by itself, and music stays silent while listening.
3. A detected blowing event fades the flames, releases the microphone, and advances to the first enabled chapter. Music starts only when enabled with after-candle playback selected, at the configured initial volume (80% by default).
4. **There's more in my heart** opens an interactive 3D heart. Selecting the heart reveals the ordered memories, one screen at a time.
5. An envelope reveals the personal letter, followed by one combined final screen: the "I'd still choose you" heading, hug GIF, optional surprise reveal, closing dedication, and replay control. There is no gift box or additional ending chapter. Long captions and messages paginate to the available space without scrolling or discarding text.

The chapters are views within the same URL, not separate browser windows. Reloading starts again at the cake. The progress marks are indicators, not skip buttons. Explicit chapter controls remain keyboard-accessible. There is no animation pause/play button; system reduced-motion preferences still select a still image instead of the GIF and static 3D poses. Music playback controls remain available separately. Without WebGL, the cake and heart have lightweight visual fallbacks.

The recipient screen has no studio link. Creators can still open `/studio` directly; only an explicit editor preview includes **Back to editor**.

The final surprise requires a nonblank response before **Send** (or Enter) reveals the configured result. Typing alone does not reveal it, and whitespace-only replies are rejected. Responses are limited to 500 characters, remain in local page state, and are cleared by replay/reload; they are not sent to the creator or stored in the backend. Any nonblank response unlocks the result, without correctness checking. This is an interaction gate, not a security boundary: the configured result is part of the shared story payload. The response-submit label remains configurable in the studio; older stock "Tell me everything" labels display as "Send".

The studio is the configuration source for each story. Theme presets and custom accent colors now affect the recipient palette and 3D heart; the opening note is rendered verbatim, and the birthday date and private cover-background display can be enabled. Celebration and final artwork can use included GIFs or private uploaded images/animations. The root `/` remains a fictional sample, not a selected creator's draft. Use the published `/experience/{token}` link to view a configured story.

## Open the Application

- Sample birthday: http://127.0.0.1:3000
- Creator studio: http://127.0.0.1:3000/studio
- Backend API: http://127.0.0.1:8000/api/session/

Use **Terminal > Run Task** in VS Code to start **Frontend: Ever after** and **Backend: Ever after**. Both services are required for accounts, uploads, saving, and sharing. The sample story works without the backend.

For the phone-facing preview, use **Frontend: Recipient preview** after building. It runs `next start`, which does not include Next.js development badges such as **1 Issue**. Stop the development server on port 3000 first. Rebuild after source changes:

```powershell
npm --prefix frontend run build
npm --prefix frontend run start -- --hostname 127.0.0.1 --port 3000
```

The production-mode frontend preview is still a local development setup with the existing Django server, not a hardened public deployment. The forwarded phone URL can continue pointing to port 3000.

Local share links work only on this computer. Sending a link to another person requires a publicly reachable HTTPS deployment.

## First-Time Setup

Prerequisites: Node.js 24, npm, and Python 3.11. The version files match Render and CI. Local development uses SQLite; CI uses PostgreSQL 17.

Run these commands from the repository root in PowerShell:

```powershell
npm --prefix frontend ci
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\.venv\Scripts\python.exe backend\manage.py migrate
```

The backend creates a cryptographically random development secret in the ignored local environment file on first startup. It persists across restarts. Never commit that file. Production requires an explicitly configured secret and `DJANGO_DEBUG=false`.

Start the backend in one terminal:

```powershell
.\.venv\Scripts\python.exe backend\manage.py runserver 127.0.0.1:8000
```

Start the frontend in another:

```powershell
npm --prefix frontend run dev -- --hostname 127.0.0.1 --port 3000
```

Use a different frontend port if 3000 is occupied and add that origin to `DJANGO_CSRF_TRUSTED_ORIGINS`. Configure `DJANGO_API_ORIGIN` when changing the backend port. Examples are provided in [backend/.env.example](backend/.env.example) and [frontend/.env.example](frontend/.env.example). Keep `localhost` and `127.0.0.1` consistent within a session because cookies belong to a host.

When accessing the studio through an HTTPS tunnel, add that exact tunnel origin to `DJANGO_CSRF_TRUSTED_ORIGINS` and restart Django. Do not disable CSRF or allow every origin. Changing tunnel URLs requires updating the configured origin.

## Create a Birthday

1. Open the studio. Begin with a blank story or explicitly choose **Start with the sample**.
2. Set names, birthday, opening note, theme preset, accent color, and optional date/cover display.
3. Add up to 20 memories. Upload images or videos, add optional dates and captions, and reorder them with the arrow controls.
4. Write a letter and closing dedication. Personal text and line breaks are preserved; no message is automatically generated.
5. In **Little details**, configure frosting, candle count, microphone sensitivity, the optional surprise, music, visible screens and their order, artwork, and screen wording.
6. Preview the complete recipient experience. Create an account or sign in to save the private draft.
7. Publish for 7, 30, or 90 days, then copy the private link. Saving later changes affects only the draft until **Publish latest changes** is selected.

**Revoke link** immediately disables the current link. Publishing after revocation generates a new one. **Delete this experience** removes its draft, publication, and uploaded files. Destructive actions require confirmation. Drafts are saved explicitly, not to browser local storage; unsaved edits are protected by navigation warnings.

There are no seeded accounts or embedded passwords. Create your own account through the interface.

## Studio Configuration

| Studio Area | Saved Recipient Settings |
| --- | --- |
| The two of you | Names, birthday, opening note, theme preset, custom accent, date visibility, optional private cover background |
| Your memories | Images/GIFs/videos, titles, captions, dates, and ordering |
| A love letter | Salutation, complete letter, and optional closing dedication; blank closing text is omitted |
| Little details: cake | Frosting, 1/3/5 candles, microphone threshold |
| Little details: soundtrack | Enabled/off, after-candle/manual playback, starting volume, uploaded music or built-in birthday tune |
| Little details: story screens | Enable and reorder celebration, heart, memories, and letter; candle stays first and finale stays last |
| Little details: artwork | Celebration/finale GIF choices or private uploads, image descriptions, automatic reduced-motion stills |
| Little details: wording | Brand, headings, eyebrow text, messages, notes, action labels, sign-offs, and replay label |
| Seal & share | Publish/republish, link expiry, copy/share, revoke, delete |

**Save draft** persists canonical, server-validated settings. **Preview** renders the same configuration without publishing. **Publish latest changes** updates the snapshot recipients see. Reordering/turning off a screen does not delete its saved content. Permissions, cancellation, error/retry messages, accessible fallback controls, and the candle gate remain application-controlled; the editor never accepts arbitrary HTML, JavaScript, or CSS.

Existing stories without the new `presentation` object receive backward-compatible defaults when loaded. No content is silently rewritten in their stored snapshots. The applied `0002_mediaasset_still_file` migration adds private reduced-motion files; run migrations when updating another checkout.

## Architecture

| Layer | Implementation |
| --- | --- |
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS |
| Interaction | Three.js, Framer Motion, Web Audio, MediaDevices, canvas-confetti |
| Design | Cormorant Garamond, DM Sans, Lucide icons, rose-pink full-screen stages |
| Backend | Django 5.2, Django REST Framework, Django sessions and CSRF |
| Storage | SQLite locally, private filesystem media; PostgreSQL configuration supported |
| Integration | Same-origin `/api/` proxy from Next.js to Django |

[docs/architecture.md](docs/architecture.md) contains the MVP decisions, data model, API contracts, authorization rules, and deployment gates. The canonical frontend content types live in [frontend/src/lib/types.ts](frontend/src/lib/types.ts), with server validation in [backend/stories/serializers.py](backend/stories/serializers.py).

The two application models are `Experience` and `MediaAsset`, plus Django's built-in `User`. Validated structured content avoids a model for every visual block. Draft JSON and published JSON are separate. Publishing captures a snapshot; a 256-bit random bearer token grants access to that snapshot and only the media it references.

## Privacy and Media

| Media | Formats | Per-File Limit | Validation |
| --- | --- | --- | --- |
| Images | JPEG, PNG, WebP, GIF | 10 MB | Format/MIME/decoder verification, metadata removal, WebP normalization; still images limited to 2200px |
| Animated images | GIF, animated WebP | 10 MB | Up to 120 frames and 60 million total decoded pixels, normalized animated WebP up to 1200px, private static first-frame WebP |
| Videos | MP4, WebM | 50 MB | MIME, extension, and container signature |
| Audio | MP3, WAV, Ogg | 15 MB | MIME, extension, and file signature |

Creators must confirm rights before uploading. Each experience is limited to 40 assets and 500 MB, and each account to 25 experiences. Removing a memory removes it from the next publication; unused files remain owner-only until the experience is deleted. Media cleanup independent of whole-story deletion is a future improvement.

Uploaded files are never exposed through a public media-directory route. Reads require the owning session or a valid, unexpired token referencing that file in the published snapshot. Audio and video support byte ranges. Private responses are not cacheable. Uploaded images bypass the public Next.js optimizer, which independently rejects all paths outside the bundled public image and animation directories.

Uploaded GIFs no longer flatten into a single frame. The upload response includes `stillUrl`; the studio saves it alongside animation URLs. Static fallbacks have the same owner/token checks as the animation, are included in storage quotas, and are deleted with the experience. Configured image URLs must reference owned assets from that same experience or explicitly allowed included artwork; arbitrary remote URLs are rejected.

Tokens are bearer secrets, not recipient identity checks. Anyone who receives a link can view it. A recipient can download or capture content while authorized; revocation cannot recall already downloaded material. No analytics or third-party media requests are made by the recipient page. Google fonts are downloaded at build time and served locally by Next.js.

## Candle and Sound

- Microphone access starts from **Blow Candles**, with a short explanation beside the button. There is no separate microphone icon or custom permission modal.
- A website cannot grant itself default microphone permission or bypass the browser prompt. If permission has already been remembered for the same origin, the browser may omit the prompt on a later button press. The app deliberately does not silently start capturing audio on page load.
- A 0.8-second ambient calibration is followed by an RMS and broadband-energy heuristic. A qualifying signal must persist for approximately 450ms.
- The detector considers the creator's threshold and the ambient noise floor. It is not a reliable classifier of human blowing; speech, wind, music, or microphone sensitivity may cause false positives or misses.
- All audio analysis stays on the device. Samples are not recorded, uploaded, or persisted. Streams and audio contexts are released on success, cancellation, navigation, hidden-page transitions, or the 14-second timeout.
- **Blow Candles** is the microphone action. A separate, explicit **Make a wish without a microphone** fallback appears after denial, unsupported hardware, an error, or detection timeout; it is not an automatic bypass. Microphone APIs require HTTPS or a supported localhost secure context. A plain HTTP LAN address on a phone is generally not a secure context.
- The candle-button gesture silently prepares Web Audio; no soundtrack plays on page load or while listening. After-candle playback, music availability, and starting volume are configured in the studio; defaults are enabled, after-candle, and 80%. Manual-start mode exposes Play without automatically starting sound. Uploaded audio takes precedence over the built-in birthday tune.
- The default melody is a locally synthesized arrangement of the public-domain Happy Birthday tune, with soft accompaniment; no third-party recording is used. A Web Audio gain controls volume, including for uploaded audio on iOS. Device volume remains controlled by the recipient's phone.
- Pause, mute, and volume controls remain available. Restarting the candle scene stops music. If a browser still blocks playback, a clear Play control permits recovery; the birthday story continues without sound.
- Motion sensors are deliberately not required. Reduced-motion preferences disable decorative motion and confetti. Sound controls become available after the wish so the app's soundtrack does not interfere with initial blow detection.
- The Three.js scene uses device-scaled rendering, baked shadows, reduced quality on software GPUs, and visibility-aware frame scheduling. Geometry, materials, observers, and renderers are disposed when leaving a scene.

## Verification

With both servers running:

```powershell
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run build
.\frontend\node_modules\.bin\playwright.cmd install chromium
npm --prefix frontend test
.\.venv\Scripts\python.exe backend\manage.py test stories
.\.venv\Scripts\python.exe backend\manage.py makemigrations --check --dry-run
```

Run `npm --prefix frontend run test:unit` for only the signal heuristics. Set `PLAYWRIGHT_BASE_URL` to test a different frontend port. Browser tests create disposable, randomly named local test accounts and delete their test stories. Tests must target a local/test instance, which may run either `next dev` or `next start`, never a live customer deployment. Playwright replaces its screenshot and trace output on each run.

Coverage includes ownership isolation, CSRF, production settings and secure proxy sessions, health checks, configuration validation, old-story defaults, draft isolation, token expiry/revocation, animated uploads and protected stills, private media ranges, image optimizer isolation, exact text preservation, reordered/disabled screens, music settings, save/reload/preview/publish parity, and the complete creator-to-recipient flow. Three.js pixel checks and desktop/mobile screenshots verify rendering, movement, framing, and reduced motion. Synthetic microphone cases cover denial, unsupported APIs, detection, cancellation, navigation, timeout, and delayed permission responses. Browser tests run one worker at a time so software GPU contexts do not compete.

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs the backend suite on PostgreSQL, the production predeploy and WSGI configuration checks, runtime dependency audits, Render Blueprint validation, frontend lint/build/typecheck, and Playwright. Under `CI=true`, Playwright manages both test servers automatically. Dependabot proposes dependency updates; changes still require passing CI.

Acceptance checks: the recipient journey must work without microphone or audio permissions; unpublished edits must not leak; another account cannot access a draft or its media; revoked links return an unavailable state; desktop and mobile views must not overflow or obscure controls.

## Before Public Deployment

Use [render.yaml](render.yaml) and follow [docs/render-deploy.md](docs/render-deploy.md). The Blueprint defines a public production Next.js service, a private Gunicorn/Django service, PostgreSQL, and a persistent private media disk. These are paid Render resources; review the current dashboard prices before creating them. Local accounts, stories, uploads, and environment files are not included in Git or copied to Render.

The deployment configuration requires a generated secret, PostgreSQL, persistent media, and the exact public HTTPS origin. It enables secure cookies, trusted proxy handling, a shared database cache, and fail-fast deployment checks. The public health endpoint checks backend database connectivity without revealing connection details. Gunicorn access logs omit URLs so bearer tokens are not logged there.

Automated checks do not certify a public service as risk-free. Complete the runbook's final-domain session/upload/revocation checks, backups and monitoring, sample-asset rights review, and real iOS/Android microphone checks before sharing publicly. Account recovery, email verification, malware scanning, video transcoding/subtitles, and edge abuse protection are not implemented by this repository. The runbook records the remaining development-only dependency advisory and the limits of application-level throttling.

The recipient retains a consistent full-screen layout, with configurable colors, content, media, and optional chapter order. It has one question/reveal activity. Collaborative editing, motion-sensor effects, additional activity types, account recovery, and advanced video processing are future enhancements, not hidden placeholders. Configuration does not bypass browser microphone or audio permission requirements.

## Sample Assets

The home page is an explicitly labeled fictional sample, not a real user's private story. Sample photographs are downloaded locally from Unsplash; replace them with creator-owned media for personal stories and review the [Unsplash license](https://unsplash.com/license) before redistribution.

- Garden celebration: https://images.unsplash.com/photo-1519741497674-611481863552
- Couple photograph: https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2
- Flowers: https://images.unsplash.com/photo-1490750967868-88aa4486c946
- Lakeside memory: https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1
- Mountain memory: https://images.unsplash.com/photo-1469474968028-56623f02e42e

The post-wish animation is the user-supplied [flowers GIF](frontend/public/animations/flowers-for-you.gif), originally named "Love You Fun GIF by BEARISH", served without changing the source. It is 480 by 444 pixels with 60 frames, not native HD; the layout avoids excessive enlargement. A first-frame WebP is used for reduced motion. The original creator's rights remain applicable; confirm permission before public distribution. The new 3D cake and heart render at the device's resolution, subject to the adaptive pixel-ratio cap.

The combined surprise and final dedication uses the user-supplied [hug GIF](frontend/public/animations/forever-hug.gif), originally named "Teddy Bear Love GIF by BEARISH", served unchanged. It is 480 by 480 pixels with 36 frames. The full frame, including its original attribution, is preserved; a matching WebP still is shown for reduced motion. The interactive 3D heart earlier in the journey remains unchanged. Unused source artwork remains local and is excluded from Git.

The cake, heart, envelope, synthesized birthday soundtrack, and sample writing are implemented directly in this project. Cormorant Garamond and DM Sans are served through `next/font`; their upstream font licenses apply. Lucide supplies the interface icons.