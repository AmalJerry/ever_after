# Ever, after. Frontend

Next.js App Router, React, TypeScript, Three.js, and Tailwind CSS power the creator studio and private birthday experience. Use Node.js 24.

From the repository root:

```powershell
npm --prefix frontend ci
npm --prefix frontend run dev -- --hostname 127.0.0.1 --port 3000
```

The interactive sample is at http://127.0.0.1:3000. Accounts, uploads, saves, and private links also require Django on port 8000. The browser calls the same-origin `/api/` proxy, not the backend directly.

For a production preview, build first, stop the development server, then run `npm --prefix frontend run start -- --hostname 127.0.0.1 --port 3000`.

See the [project setup and verification guide](../README.md), [architecture](../docs/architecture.md), and [Render deployment runbook](../docs/render-deploy.md). Accounts, uploads, and sharing require a backend. The free Render profile uses temporary SQLite/media storage and public HTTPS API proxying; data does not survive reliably across sleep, restart, or redeployment. Durable hosting needs a separate persistent-storage configuration.
