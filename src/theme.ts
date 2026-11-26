/**
 * Orvyn Mobile design tokens (design direction D): a flat ground, rounded 24px surfaces, pill
 * controls and light blue as the one brand colour. Values come from design/tokens.json via
 * ./tokens (generated). No gradients, gold or purple.
 *
 * Light or dark follows the phone's setting. Screens build their styles once, so the palette is
 * chosen when the app starts; when the setting changes, the app reloads (see app/_layout.tsx).
 */
import { Appearance } from "react-native";
import { brand, dark, light, radius as R } from "./tokens";

/** The scheme this launch was built for. */
export const scheme: "light" | "dark" = Appearance.getColorScheme() === "light" ? "light" : "dark";
const p = scheme === "light" ? light : dark;
const isLight = scheme === "light";

export const colors = {
  bg: p.bg,
  bg2: p.surface1,
  card: p.surface1,
  card2: p.surface2,
  /** Secondary buttons and inputs: visible both on the page and inside a card. */
  control: isLight ? p.surface3 : p.surface2,
  card3: p.surface3,
  line: p.line,
  line2: p.lineStrong,
  fg: p.fg,
  fg2: p.fg2,
  fg3: p.fg3,
  /** Light blue as a fill (blocks, active pills, primary buttons): the same in both themes. */
  sky: brand.sky,
  /** Accent for text, icons and lines: light blue on dark, deep blue on light (readable on white). */
  accent: p.accent,
  accentDeep: p.accent,
  accentSoft: isLight ? "rgba(10,111,194,0.10)" : "rgba(139,200,255,0.14)",
  accentLine: isLight ? "rgba(10,111,194,0.35)" : "rgba(139,200,255,0.4)",
  /** Text and icons on a light-blue fill. */
  onAccent: brand.onSky,
  /** Older names, kept so screens compile; all map onto the one palette. */
  magenta: p.accent,
  indigo: p.accent,
  cyan: p.accent,
  violet: p.accent,
  ink: p.bg,
  inverse: p.inverse,
  onInverse: p.onInverse,
  up: p.up,
  down: p.down,
  downSoft: isLight ? "rgba(180,35,24,0.10)" : "rgba(248,113,113,0.14)",
  warn: p.warn,
  warnSoft: isLight ? "rgba(161,92,0,0.12)" : "rgba(255,200,87,0.14)",
};

export const fonts = {
  display: "SchibstedGrotesk_800ExtraBold",
  displaySemi: "SchibstedGrotesk_700Bold",
  displayMedium: "SchibstedGrotesk_600SemiBold",
  text: "SchibstedGrotesk_400Regular",
  textMedium: "SchibstedGrotesk_500Medium",
  textSemi: "SchibstedGrotesk_600SemiBold",
  textBold: "SchibstedGrotesk_700Bold",
  mono: "JetBrainsMono_400Regular",
  monoMedium: "JetBrainsMono_500Medium",
  monoBold: "JetBrainsMono_700Bold",
};

/** How an agent looks at a glance: its mood, from its state. */
export type Mood = "active" | "up" | "down" | "idle" | "waiting" | "error";
export const MOODS: Record<Mood, { core: string; edge: string; label: string; period: number }> = {
  active: { core: brand.sky, edge: p.accent, label: "Working", period: 1700 },
  up: { core: p.up, edge: p.up, label: "In profit", period: 1900 },
  down: { core: p.down, edge: p.down, label: "Drawdown", period: 2100 },
  idle: { core: p.fg3, edge: p.fg3, label: "Idle", period: 3400 },
  waiting: { core: p.warn, edge: p.warn, label: "Waiting", period: 2600 },
  error: { core: p.down, edge: p.down, label: "Needs you", period: 900 },
};

export const radius = { sm: R.sm, md: R.md, lg: R.lg, xl: R.xl, pill: R.pill };
export const space = (n: number) => n * 4;

/** Room for the floating tab bar at the bottom of tab screens. */
export const TAB_BAR_SPACE = 120;
