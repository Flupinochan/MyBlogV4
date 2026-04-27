import * as d3 from "d3";
import type { GitHubCommitCount } from "../../../types/github";
import type { MergedLangStats } from "./index";

type StyleAxisFn = (
  sel: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
) => void;

export class StackChart {
  readonly xStackTime: d3.ScaleTime<number, number>;
  readonly yStack: d3.ScaleLinear<number, number>;
  readonly borderPath: d3.Selection<SVGPathElement, unknown, HTMLElement, any>;
  readonly gStackXAxis: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  readonly gStackYAxis: d3.Selection<SVGGElement, unknown, HTMLElement, any>;

  private readonly timeExtent: [Date, Date];
  private readonly bisectDate: d3.Bisector<GitHubCommitCount, Date>["left"];

  constructor(
    svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>,
    private readonly mergedData: MergedLangStats[],
    private readonly commitData: GitHubCommitCount[],
    private readonly width: number,
    private readonly height: number,
    private readonly margin: number,
    styleAxis: StyleAxisFn,
  ) {
    const maxTotal = commitData[commitData.length - 1]?.total || 0;
    this.timeExtent = d3.extent(commitData, (d) => new Date(d.date)) as [
      Date,
      Date,
    ];
    this.bisectDate = d3.bisector(
      (d: GitHubCommitCount) => new Date(d.date),
    ).left;

    this.yStack = d3
      .scaleLinear()
      .domain([0, maxTotal])
      .nice()
      .range([height - margin, margin]);

    this.xStackTime = d3
      .scaleTime()
      .domain(this.timeExtent)
      .range([margin, width - margin]);

    this.borderPath = svg
      .append("path")
      .attr(
        "d",
        d3
          .line<GitHubCommitCount>()
          .x((d) => this.xStackTime(new Date(d.date)))
          .y((d) => this.yStack(d.total))
          .curve(d3.curveMonotoneX)(commitData) || "",
      )
      .attr("fill", "none")
      .attr(
        "class",
        "stroke-violet-400 dark:stroke-violet-300 stroke-2 opacity-0 pointer-events-none",
      );

    this.gStackXAxis = svg
      .append("g")
      .attr("transform", `translate(0, ${height - margin})`)
      .attr("class", "opacity-0")
      .call(
        d3
          .axisBottom(this.xStackTime)
          .ticks(5)
          .tickFormat(d3.timeFormat("%Y-%m") as never),
      )
      .call(styleAxis);

    this.gStackYAxis = svg
      .append("g")
      .attr("transform", `translate(${margin}, 0)`)
      .attr("class", "opacity-0")
      .call(d3.axisLeft(this.yStack).ticks(5).tickFormat(d3.format(",d")))
      .call(styleAxis);
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

  getStackPath(index: number): string {
    const n = this.mergedData.length;
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
        .x((d) => this.xStackTime(new Date(d.date)))
        .y0(this.height - this.margin)
        .y1((d) => this.yStack(d.total))
        .curve(d3.curveMonotoneX)(segData) ?? ""
    );
  }

  getTarget(d: d3.PieArcDatum<MergedLangStats>, stableIndex: number) {
    const n = this.mergedData.length;
    const reversedIndex = n - 1 - stableIndex;
    const midTime = this.getTimeAt((reversedIndex + 0.5) / n);
    return {
      path: this.getStackPath(reversedIndex),
      labelX: this.xStackTime(midTime),
      labelY: this.yStack(this.interpolateCommitTotal(midTime)) - 10,
    };
  }
}
