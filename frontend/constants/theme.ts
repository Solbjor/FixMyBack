// ─────────────────────────────────────────────────────────────────────────────
// theme.ts  —  single source of truth for every color in the app
// Edit values here and they update everywhere automatically.
// ─────────────────────────────────────────────────────────────────────────────

// ── Your 5 brand colors ───────────────────────────────────────────────────────
export const brand = {
  green:  '#7DB96A',  // sage green   → success, checkmarks, posture ring
  yellow: '#F5D15A',  // warm yellow  → highlights, warnings (soft)
  orange: '#F0923A',  // vivid orange → CTA pill, active tab, action buttons
  teal:   '#4A9E7F',  // deep teal    → accent, links, settings button
  red:    '#D94040',  // clear red    → error alerts, destructive actions
};

// ── Surfaces & backgrounds ────────────────────────────────────────────────────
export const colors = {
  // Backgrounds
  bgPage:        '#EEEAE3',   // main screen background (beige)
  bgCard:        '#ffffff',   // white card surface
  bgSubtle:      '#f7f4ef',   // inner stat cards, muted surfaces
  bgDark:        brand.orange, // CTA pill, active tab  ← was #111111

  // Borders
  borderLight:   '#ddd6c8',
  borderSubtle:  '#ede9e2',

  // Text
  textPrimary:   '#111111',
  textBody:      '#3f3a31',
  textMuted:     '#7a7466',
  textOnDark:    '#ffffff',
  textOnDarkDim: 'rgba(255,255,255,0.65)',

  // Brand accents (pulled straight from `brand`)
  accent:        brand.teal,    // settings button, links
  success:       brand.green,   // posture ring, checkmarks, "Good" text
  successDot:    brand.green,   // completed week dots
  alertError:    brand.red,     // red alert dot
  alertWarning:  brand.yellow,  // yellow/warning alert dot
  highlight:     brand.yellow,  // optional highlight use
};

// ── Typography scale ──────────────────────────────────────────────────────────
export const fontSize = {
  xs:    11,
  sm:    12,
  base:  13,
  md:    15,
  lg:    17,
  xl:    20,
  '2xl': 24,
  '3xl': 34,
};

// ── Border radius ─────────────────────────────────────────────────────────────
export const radius = {
  sm:   12,
  md:   20,
  lg:   28,
  full: 999,
};