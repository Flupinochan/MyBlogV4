export type BadgeColor =
  | "current"
  | "violet"
  | "cyan"
  | "amber"
  | "rose"
  | "emerald"
  | "slate";

export type BadgeRounded = "full" | "md";

export const COLOR_MAP: Record<BadgeColor, string> = {
  current: "bg-current/10",
  violet: "bg-violet-500/10 text-violet-500",
  cyan: "bg-cyan-500/10 text-cyan-500",
  amber: "bg-amber-500/10 text-amber-500",
  rose: "bg-rose-500/10 text-rose-500",
  emerald: "bg-emerald-500/10 text-emerald-500",
  slate:
    "bg-slate-500/10 text-slate-500 dark:bg-slate-300/10 dark:text-slate-300",
};
