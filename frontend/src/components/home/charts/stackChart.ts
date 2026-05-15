import * as d3 from "d3";
import type { GitHubCommitCount } from "./github.types";
import type { MergedLangStats, StyleAxisFn } from "./main";
import type { Tooltip } from "./tooltip";

// StackChartに関するデータとUIを管理
export class StackChart {
  readonly fillColor: string = "#ad46ff"; // color-violet-500
  readonly maxTotal: number;
  // Scale
  readonly xScale: d3.ScaleTime<number, number>;
  readonly yScale: d3.ScaleLinear<number, number>;
  // UIは初期表示では非表示
  // Axis UI
  readonly xAxis: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  readonly yAxis: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  // Border UI
  readonly borderPath: d3.Selection<SVGPathElement, unknown, HTMLElement, any>;

  private readonly timeExtent: [Date, Date];
  private readonly bisectDate: d3.Bisector<GitHubCommitCount, Date>["left"];

  constructor(
    svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>,
    private readonly commitData: GitHubCommitCount[],
    private readonly width: number,
    private readonly height: number,
    private readonly margin: number,
    private readonly tooltip: Tooltip,
    styleAxis: StyleAxisFn,
  ) {
    this.maxTotal = commitData[commitData.length - 1]?.total || 0;
    this.timeExtent = d3.extent(commitData, (d) => new Date(d.date)) as [
      Date,
      Date,
    ];
    this.bisectDate = d3.bisector(
      (d: GitHubCommitCount) => new Date(d.date),
    ).left;

    this.xScale = d3
      .scaleTime()
      .domain(this.timeExtent)
      .range([margin, width - margin])
      .nice();

    this.yScale = d3
      .scaleLinear()
      .domain([0, this.maxTotal])
      .range([height - margin, margin])
      .nice();

    const [yMin, yMax] = this.yScale.domain();
    const yTickValues = d3.range(2).map((i) => yMin + ((yMax - yMin) / 1) * i);

    this.xAxis = svg
      .append("g")
      .attr("transform", `translate(0, ${height - margin})`)
      .attr("class", "opacity-0")
      .call(
        d3
          .axisBottom(this.xScale)
          .ticks(5)
          .tickFormat(d3.timeFormat("%Y-%m") as never),
      )
      .call(styleAxis);

    this.yAxis = svg
      .append("g")
      .attr("transform", `translate(${margin}, 0)`)
      .attr("class", "opacity-0")
      .call(
        d3
          .axisLeft(this.yScale)
          .tickValues(yTickValues)
          .tickFormat(d3.format(",d")),
      )
      .call(styleAxis);

    this.borderPath = svg
      .append("path")
      .attr(
        "d",
        d3
          .line<GitHubCommitCount>()
          .x((d) => this.xScale(new Date(d.date)))
          .y((d) => this.yScale(d.total))
          .curve(d3.curveMonotoneX)(commitData) || "",
      )
      .attr("fill", "none")
      .attr(
        "class",
        "stroke-violet-400 dark:stroke-violet-300 stroke-2 opacity-0 pointer-events-none",
      );
  }

  private get totalMs(): number {
    return this.timeExtent[1].getTime() - this.timeExtent[0].getTime();
  }

  // 時間軸上の割合（0〜1）から Date を返す
  private getTimeAt(fraction: number): Date {
    return new Date(this.timeExtent[0].getTime() + this.totalMs * fraction);
  }

  private interpolateCommitTotal(date: Date): number {
    const idx = this.bisectDate(this.commitData, date);
    if (idx === 0) return this.commitData[0].total;
    if (idx >= this.commitData.length)
      return this.commitData[this.commitData.length - 1].total;
    const d0 = this.commitData[idx - 1];
    const d1 = this.commitData[idx];
    const t =
      (date.getTime() - new Date(d0.date).getTime()) /
      (new Date(d1.date).getTime() - new Date(d0.date).getTime());
    return d0.total + t * (d1.total - d0.total);
  }

  getStackPath(mergedLangStats: MergedLangStats[], index: number): string {
    const n = mergedLangStats.length;
    const segStart = this.getTimeAt(index / n);
    const segEnd = this.getTimeAt((index + 1) / n);

    const segData: GitHubCommitCount[] = [
      {
        date: segStart.toISOString(),
        count: 0,
        total: this.interpolateCommitTotal(segStart),
      },
      ...this.commitData.filter((d) => {
        const t = new Date(d.date).getTime();
        return t > segStart.getTime() && t < segEnd.getTime();
      }),
      {
        date: segEnd.toISOString(),
        count: 0,
        total: this.interpolateCommitTotal(segEnd),
      },
    ];

    return (
      d3
        .area<GitHubCommitCount>()
        .x((d) => this.xScale(new Date(d.date)))
        .y0(this.height - this.margin)
        .y1((d) => this.yScale(d.total))
        .curve(d3.curveMonotoneX)(segData) ?? ""
    );
  }

  // アニメーション先のpathとlabel positionを返却
  getTarget(mergedLangStats: MergedLangStats[], stableIndex: number) {
    const n = mergedLangStats.length;
    const reversedIndex = n - 1 - stableIndex;
    const midTime = this.getTimeAt((reversedIndex + 0.5) / n);
    return {
      path: this.getStackPath(mergedLangStats, reversedIndex),
      labelX: this.xScale(midTime),
      labelY: this.yScale(this.interpolateCommitTotal(midTime)) - 10,
    };
  }

  showAxis(tl: gsap.core.Timeline, duration: number, ease: string) {
    tl.to(this.xAxis.node(), { opacity: 1, duration, ease }, 0);
    tl.to(this.yAxis.node(), { opacity: 1, duration, ease }, 0);
  }

  hideAxis(tl: gsap.core.Timeline, duration: number, ease: string) {
    tl.to(this.xAxis.node(), { opacity: 0, duration, ease }, 0);
    tl.to(this.yAxis.node(), { opacity: 0, duration, ease }, 0);
  }

  showBorder(tl: gsap.core.Timeline, duration = 0.1, ease = "none") {
    tl.to(this.borderPath.node(), { opacity: 1, duration, ease });
  }

  hideBorder(tl: gsap.core.Timeline, duration = 0.1, ease = "none") {
    tl.to(this.borderPath.node(), { opacity: 0, duration, ease });
  }
}
