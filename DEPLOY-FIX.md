# MIVO V5 FIXED — Vercel

This archive is the complete MIVO V5 source. Do not merge it over an older V2.1 tree file-by-file; replace the old project source (while preserving your own secrets only in Vercel Environment Variables).

Verified fixes:
- `components/ui/sonner.tsx` exists for `app/providers.tsx`.
- `sonner` is declared in dependencies.
- `package.json` and `package-lock.json` are MIVO V5 `5.0.0`.
- Vercel build command is `npm run build` -> `next build`.
- V5 migration `db/migrations/0004_mivo_v5_platform.sql` is included.

Recommended Vercel settings:
- Framework Preset: Next.js
- Install Command: `npm ci`
- Build Command: `npm run build`
- Output Directory: default

Before production, configure the required values from `.env.example` in Vercel Environment Variables and run database migrations.
