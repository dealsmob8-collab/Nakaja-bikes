# AGENT GUIDE: Nakaja Bikes Landing Page

## Project mission
Drive qualified WhatsApp leads for boda boda motorcycle sales in Nairobi, with conversion-first messaging around financing and immediate earning.

## Business constraints
- Dealer name: **Nakaja Bikes**
- Brand position: **Authorized UM Motorcycles Dealer**
- Origin: **USA Originated**
- Primary slogan: **The Strength to Carry Your Hustle**
- Secondary slogan: **The Strength of the Boda Boda**
- Location: **Cnr. Busia & Enterprise Road, Industrial Area, Nairobi**
- Warranty: **1 Year / 12,000KM Warranty**

## Non-negotiable branding rules
Always preserve rugged, practical, high-trust tone. Keep visual hierarchy bold and mobile-first.

## Critical phone number rule
Use only:
- Display number: `0729 595 077`
- WhatsApp: `https://wa.me/254729595077`

Never add or swap in any other number.

## Pricing source of truth
`assets/pricing-data.json` is canonical for financing/cash values.
Do not hardcode conflicting numbers in JavaScript or HTML.

## UI/UX priorities
1. Above-the-fold WhatsApp CTA
2. Fast mobile load and clear typography
3. Clear financing + deposit communication
4. Simple calculator with prefilled WhatsApp lead message
5. Accessible interactions and focus states

## Performance rules
- No heavy frameworks.
- Minimal JS and no unnecessary dependencies.
- Lazy-load non-critical images.
- Keep LCP elements lean.
- Avoid sliders/carousels requiring large scripts.

## What not to break
- Calculator model/plan logic.
- WhatsApp prefill for selected plan.
- Promo strip rotation and fallback readability.
- Analytics hook names.
- Structured data validity.

## How to test changes
- Open `index.html` with a static server.
- Verify all CTA URLs include correct WhatsApp number.
- Validate pricing outputs for each model/plan.
- Keyboard test accordions and buttons.
- Run Lighthouse mobile profile.

## Deployment notes
Cloudflare Pages static deployment from repository root.
No build step required.

## Review checklist
- [ ] Correct phone and WhatsApp links everywhere
- [ ] Pricing matches `assets/pricing-data.json`
- [ ] Deposit message remains Kes. 30,000
- [ ] Warranty details unchanged
- [ ] Mobile-first layout still clear
- [ ] Accessibility basics pass
- [ ] Headers/redirects still valid

## Pre-ship QA checklist
- [ ] Hero CTA visible without scrolling on common Android viewport
- [ ] No broken images or layout shifts
- [ ] FAQ/schema still present
- [ ] Analytics events fire without errors
- [ ] Final CTA and support widget route to WhatsApp
