import * as d3 from "d3";
import type { MergedLangStats } from "./main";

export class Tooltip {
  private readonly el: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;

  constructor() {
    this.el = d3
      .select("body")
      .append("div")
      .attr(
        "class",
        "absolute invisible pointer-events-none z-50 rounded-md border p-2 text-xs shadow-lg bg-white/95 border-slate-200 text-slate-700 dark:bg-slate-900/95 dark:border-slate-700 dark:text-slate-200 backdrop-blur-sm transition-opacity duration-200",
      );
  }

  attachEvent(
    elements: d3.Selection<
      SVGGElement,
      d3.PieArcDatum<MergedLangStats>,
      SVGGElement,
      unknown
    >,
    getParams: (d: d3.PieArcDatum<MergedLangStats>) => {
      color: string;
      label: string;
      value: string;
    },
  ) {
    elements
      .on("mouseover", (event, d) => {
        const { color, label, value } = getParams(d);
        this.show(
          `<span style="color:${color}">●</span> <span class="font-bold">${label}</span>: ${value}`,
          event,
        );
      })
      .on("mousemove", (event) => this.move(event))
      .on("mouseleave", () => this.hide());
  }

  removeEvent(elements: d3.Selection<any, any, any, any>) {
    elements.on("mouseover", null).on("mousemove", null).on("mouseleave", null);
  }

  show(html: string, event: MouseEvent) {
    const [mx, my] = d3.pointer(event, document.body);
    this.el
      .classed("invisible", false)
      .classed("visible", true)
      .html(html)
      .style("top", `${my - 10}px`)
      .style("left", `${mx + 10}px`);
  }

  hide() {
    this.el.classed("invisible", true).classed("visible", false);
  }

  move(event: MouseEvent) {
    const [mx, my] = d3.pointer(event, document.body);
    this.el.style("top", `${my - 10}px`).style("left", `${mx + 10}px`);
  }
}
