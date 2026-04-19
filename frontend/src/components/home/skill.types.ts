import type { SvgComponent } from "astro/types";

export interface SkillItem {
  icon: SvgComponent;
  title: string;
  summary: string;
  details: string;
  color: string;
  tooltips: string[];
}
