import type { BadgeColor, BadgeRounded } from "./badge.types";
import { COLOR_MAP } from "./badge.types";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  color: BadgeColor;
  rounded?: BadgeRounded;
  border?: boolean;
}

export function Badge({
  color,
  rounded = "full",
  border = false,
  className = "",
  children,
  ...rest
}: React.PropsWithChildren<BadgeProps>) {
  const classes = [
    "px-2 py-0.5 text-xs font-medium leading-none inline-block",
    rounded === "full" ? "rounded-full" : "rounded-md",
    COLOR_MAP[color],
    border ? "border border-current/30" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}
