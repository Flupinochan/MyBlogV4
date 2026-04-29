import * as d3 from "d3";
import type { MergedLangStats, StyleAxisFn } from "./main";
import type { Tooltip } from "./tooltip";

export class BarChart {
  readonly xScale: d3.ScaleBand<string>;
  readonly yScale: d3.ScaleLinear<number, number>;
  readonly xAxis: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  readonly yAxis: d3.Selection<SVGGElement, unknown, HTMLElement, any>;

  constructor(
    // svgとarrayデータは全てのグラフで共通して参照して利用
    svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>,
    mergedLangStats: MergedLangStats[],
    private readonly width: number,
    private readonly height: number,
    private readonly margin: number,
    private readonly tooltip: Tooltip,
    styleAxis: StyleAxisFn,
  ) {
    this.xScale = d3
      .scaleBand()
      .rangeRound([0, width - margin * 2])
      .padding(0.3);

    this.yScale = d3
      .scaleLinear()
      .rangeRound([height - margin * 2, 0])
      .domain([0, d3.max(mergedLangStats, (d) => d.repoBytes) || 0])
      .nice();

    this.xAxis = svg
      .append("g")
      .attr("class", "x-axis opacity-0")
      .attr("transform", `translate(${margin}, ${height - margin})`)
      .call(
        d3
          .axisBottom(this.xScale)
          .tickSize(0)
          .tickFormat(() => ""),
      )
      .call(styleAxis);

    this.yAxis = svg
      .append("g")
      .attr("class", "y-axis opacity-0")
      .attr("transform", `translate(${margin}, ${margin})`)
      .call(
        d3
          .axisLeft(this.yScale)
          .ticks(5)
          .tickFormat(d3.format(".2s"))
          .tickSizeInner(-width + margin * 2)
          .tickSizeOuter(0),
      )
      .call(styleAxis);
  }

  showAxis(tl: gsap.core.Timeline, duration: number, ease: string) {
    tl.to(this.xAxis.node(), { opacity: 1, duration, ease }, 0);
    tl.to(this.yAxis.node(), { opacity: 1, duration, ease }, 0);
  }

  hideAxis(tl: gsap.core.Timeline, duration: number, ease: string) {
    tl.to(this.xAxis.node(), { opacity: 0, duration, ease }, 0);
    tl.to(this.yAxis.node(), { opacity: 0, duration, ease }, 0);
  }

  /**
   * アニメーションする際にソートしたデータを軸に反映させる
   * @param mergedLangStats ソート済みのデータ
   */
  updateAxes(mergedLangStats: MergedLangStats[]) {
    this.xScale.domain(mergedLangStats.map((d) => d.langName));
  }

  // d3jsのBarはrectのため、アニメーションするためにpathに変換
  private getBarPath(data: MergedLangStats): string {
    const by = this.yScale(data.repoBytes) || 0;
    const bw = this.xScale.bandwidth();
    const bh = this.height - this.margin * 2 - by;
    return `M 0,${by} L ${bw},${by} L ${bw},${by + bh} L 0,${by + bh} Z`;
  }

  // Barのpathと座標を返却
  getTarget(data: MergedLangStats) {
    return {
      path: this.getBarPath(data),
      elementX: this.margin + (this.xScale(data.langName) || 0),
      elementY: this.margin,
      labelX: this.xScale.bandwidth() / 2,
      labelY: this.yScale(data.repoBytes) - 15,
    };
  }
}
