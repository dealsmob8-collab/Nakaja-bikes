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
- `public/manifest.webmanifest` - PWA basics.
- `public/favicon.svg` - favicon.
- `_headers` - Cloudflare security and cache headers.
- `_redirects` - static fallback and canonical behavior.
- `robots.txt`, `sitemap.xml` - search crawl support.
- `AGENT.md` - contributor guardrails.

## Deploy to Cloudflare Pages
1. Push repository to GitHub/GitLab.
2. In Cloudflare Pages, create a new project from repo.
3. Build command: **(leave empty)**.
4. Build output directory: **/** (root).
5. Deploy.

## Update images
- Main images are Cloudinary URLs in `index.html`.
- Replace `src` values with your optimized Cloudinary transforms.
- Keep hero as high priority; keep secondary imagery `loading="lazy"`.

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

## Copy customization
- Core page copy is in `index.html`.
- Shared factual content can also be maintained in `assets/content-data.json` for future templating.

## Recommended pre-launch checks
- Test on Android low-end emulation.
- Run Lighthouse (mobile): performance, accessibility, SEO.
- Verify all CTAs point to `https://wa.me/254729595077`.
- Confirm calculator outputs match approved pricing.
- Check keyboard navigation and focus states.
