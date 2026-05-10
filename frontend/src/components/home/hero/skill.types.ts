import type { SvgComponent } from "astro/types";
import type { BadgeColor } from "../../layout/badge.types";

export interface SkillItem {
  icon: SvgComponent;
  title: string;
  description: string;
  tooltips: string[];
  textColor: string;
  badgeColor: BadgeColor;
}
