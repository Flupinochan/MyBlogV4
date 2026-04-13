export type AccentColor = "violet" | "cyan" | "amber" | "rose" | "emerald";

const ACCENT_COLOR_VARIABLES: Record<AccentColor, string> = {
  violet: "--color-violet-500",
  cyan: "--color-cyan-500",
  amber: "--color-amber-500",
  rose: "--color-rose-500",
  emerald: "--color-emerald-500",
};

export function getAccentColor(color: AccentColor): string {
  return `var(${ACCENT_COLOR_VARIABLES[color]})`;
}

export function isAccentColor(value: string): value is AccentColor {
  return value in ACCENT_COLOR_VARIABLES;
}
