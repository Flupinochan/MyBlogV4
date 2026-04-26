import type { SvgComponent } from "astro/types";

export interface SkillItem {
  icon: SvgComponent;
  title: string;
  description: string;
  tooltips: string[];
  textColor: string;
}
