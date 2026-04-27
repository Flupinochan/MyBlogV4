import * as d3 from "d3";
import type { MergedLangStats } from "./index";

type StyleAxisFn = (
  sel: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
) => void;

export class BarChart {
  readonly x: d3.ScaleBand<string>;
  readonly y: d3.ScaleLinear<number, number>;
  readonly gXAxis: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  readonly gYAxis: d3.Selection<SVGGElement, unknown, HTMLElement, any>;

  constructor(
    svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>,
    private readonly mergedData: MergedLangStats[],
    private readonly width: number,
    private readonly height: number,
    private readonly margin: number,
  ) {
    this.x = d3
      .scaleBand()
      .rangeRound([0, width - margin * 2])
      .padding(0.3);

    this.y = d3
      .scaleLinear()
      .rangeRound([height - margin * 2, 0])
      .domain([0, d3.max(mergedData, (d) => d.repoBytes) || 0]);

    this.gXAxis = svg
      .append("g")
      .attr("class", "x-axis opacity-0")
      .attr("transform", `translate(${margin}, ${height - margin})`);

    this.gYAxis = svg
      .append("g")
      .attr("class", "y-axis opacity-0")
      .attr("transform", `translate(${margin}, ${margin})`);
  }

  // ソート後に呼び出し、軸ドメインと描画を更新する
  updateAxes(styleAxis: StyleAxisFn) {
    this.x.domain(this.mergedData.map((d) => d.langName));
    this.gXAxis
      .call(
        d3
          .axisBottom(this.x)
          .tickSize(0)
          .tickFormat(() => ""),
      )
      .call(styleAxis);
    this.gYAxis
      .call(
        d3
          .axisLeft(this.y)
          .ticks(5)
          .tickFormat(d3.format(".2s"))
          .tickSizeOuter(0),
      )
      .call(styleAxis);
  }

  private getBarPath(data: MergedLangStats): string {
    const by = this.y(data.repoBytes) || 0;
    const bw = this.x.bandwidth();
    const bh = this.height - this.margin * 2 - by;
    return `M 0,${by} L ${bw},${by} L ${bw},${by + bh} L 0,${by + bh} Z`;
  }

  getTarget(d: d3.PieArcDatum<MergedLangStats>) {
    return {
      path: this.getBarPath(d.data),
      // g要素自体の移動先
      elementX: this.margin + (this.x(d.data.langName) || 0),
      elementY: this.margin,
      // g要素内でのラベル座標
      labelX: this.x.bandwidth() / 2,
      labelY: this.y(d.data.repoBytes) - 10,
    };
  }
}
