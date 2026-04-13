export type CursorShape = "circle" | "square" | "star" | "diamond" | "cross";
export type CursorColor = "violet" | "cyan" | "amber" | "rose" | "emerald";

const CURSOR_COLOR_VARIABLES: Record<CursorColor, string> = {
  violet: "--color-violet-500",
  cyan: "--color-cyan-500",
  amber: "--color-amber-500",
  rose: "--color-rose-500",
  emerald: "--color-emerald-500",
};

export function getTailwindColor(color: CursorColor): string {
  return `var(${CURSOR_COLOR_VARIABLES[color]})`;
}

export function isCursorColor(value: string): value is CursorColor {
  return value in CURSOR_COLOR_VARIABLES;
}
