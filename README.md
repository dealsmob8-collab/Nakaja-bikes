# Nakaja Bikes Landing Page

Production-ready static landing page for **Nakaja Bikes** (Authorized UM Motorcycles Dealer), built for Cloudflare Pages and optimized for high WhatsApp lead conversion from Nairobi boda boda riders.

## Purpose
- Convert visitors into qualified WhatsApp leads.
- Promote financing with **Kes. 30,000 deposit**.
- Highlight key trust factors: warranty, heavy-load capability, PDL support, and Nairobi location.

## Structure
- `index.html` - semantic single-page layout, SEO metadata, schema markup.
- `assets/styles.css` - mobile-first, high-contrast styling.
- `assets/app.js` - promo rotation, accordions, calculator logic, analytics hooks.
- `assets/pricing-data.json` - source of truth for calculator model/plan pricing.
- `assets/content-data.json` - shared business content payload for future integrations.
- `assets/supabase-storage-manifest.json` - generated manifest of uploaded Supabase Storage asset URLs.
- `functions/api/leads.js` - Cloudflare Pages Function for lead capture.
- `public/manifest.webmanifest` - PWA basics.
- `public/favicon.svg` - favicon.
- `public/site-photo.svg` - single shared campaign image placeholder.
- `scripts/upload-supabase-assets.mjs` - creates the Supabase Storage bucket and uploads local image assets.
- `supabase/migrations/20260312_create_leads.sql` - leads table schema for Supabase.
- `_headers` - Cloudflare security and cache headers.
- `_redirects` - static fallback and canonical behavior.
- `wrangler.toml` - local Pages dev configuration.
- `robots.txt`, `sitemap.xml` - search crawl support.
- `AGENT.md` - contributor guardrails.

## Free-Tier Stack
- Frontend + serverless endpoint: Cloudflare Pages with Pages Functions on the free plan.
- Database: Supabase free project using Postgres + REST API.
- Secrets: Cloudflare Pages environment variables.
- No paid Cloudflare products are required for the current setup.

## Deploy to Cloudflare Pages
1. Push repository to GitHub/GitLab.
2. In Cloudflare Pages, create a new project from repo.
3. Build command: **(leave empty)**.
4. Build output directory: **/** (root).
5. Add environment variables in Pages project settings:
   - `SUPABASE_URL` (optional in this repo, already defaults to `https://dwrvycpeyknmidrmnnby.supabase.co`)
   - `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_LEADS_TABLE=leads`
   - Optional webhook variables if you also want CRM forwarding.
6. Deploy.

## Supabase setup
1. Create a free Supabase project.
2. Run the SQL in `supabase/migrations/20260312_create_leads.sql`.
3. In Supabase project settings, copy:
   - Project URL -> `SUPABASE_URL` (this repo already defaults to `https://dwrvycpeyknmidrmnnby.supabase.co`)
   - Secret key or service role key -> `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
4. Store those only in Cloudflare Pages environment variables or local `.dev.vars`.

## Update images
- One shared image now drives the hero and social preview: `public/site-photo.svg`.
- Replace that single file with your approved campaign image asset when ready.
- If you swap to a raster asset instead of SVG, update the matching `og:image`, `twitter:image`, and hero `src` in `index.html`.
- To upload a local image folder into Supabase Storage, run `node scripts/upload-supabase-assets.mjs`.
- Default source folder is `/home/paulaflare/Desktop/images`.
- Upload results are written to `assets/supabase-storage-manifest.json`.

## Update pricing
- Edit only `assets/pricing-data.json`.
- Calculator auto-renders model and plans from this file.

## WhatsApp link generation
- Base URL is fixed in `assets/app.js` as `https://wa.me/254729595077`.
- Calculator CTA auto-generates prefilled booking message using selected model + duration.

## Analytics wiring
`assets/app.js` supports graceful hooks for:
- Plausible (`window.plausible`)
- GA4 (`window.gtag`)
- Cloudflare Web Analytics (`window.__cfWebAnalytics`)
- Generic dataLayer push

No provider configured = no breakage.

## Lead form routing
- Lead form posts to same-origin endpoint: `/api/leads`.
- Cloudflare Pages Function lives at `functions/api/leads.js`.
- Primary storage is Supabase over the REST API from the Cloudflare function.
- To enable Supabase storage, set these Cloudflare environment variables:
  - `SUPABASE_URL` (optional if you use the default project URL already baked into the function)
  - `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_LEADS_TABLE` (optional, defaults to `leads`)
- The Supabase secret or service-role credential must stay server-side only. Never expose it in browser code.
- Optional: also forward every stored lead into a CRM or automation webhook with:
  - `CRM_WEBHOOK_URL`
  - `CRM_WEBHOOK_TOKEN` (optional)
  - `CRM_WEBHOOK_TOKEN_HEADER` (optional, defaults to `Authorization`)
  - `CRM_WEBHOOK_TOKEN_PREFIX` (optional, defaults to `Bearer `)
  - `CRM_WEBHOOK_SECRET` (optional, sent as `x-crm-webhook-secret`)

## Local development
- Copy `.dev.vars.example` to `.dev.vars` and fill in your Supabase values.
- Run `npx wrangler pages dev .`
- Submit the lead form locally; the Pages Function will insert directly into Supabase if the env vars are set.

## Copy customization
- Core page copy is in `index.html`.
- Shared factual content can also be maintained in `assets/content-data.json` for future templating.

## Recommended pre-launch checks
- Test on Android low-end emulation.
- Run Lighthouse (mobile): performance, accessibility, SEO.
- Verify all CTAs point to `https://wa.me/254729595077`.
- Confirm calculator outputs match approved pricing.
- Check keyboard navigation and focus states.

## PR recovery note
If a pull request is deleted or closed accidentally, create a new PR from the latest commit on this branch; no build tooling changes are required.
