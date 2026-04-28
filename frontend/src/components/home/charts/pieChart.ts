import * as d3 from "d3";
import type { MergedLangStats } from "./index";

// PieChart用のデータを初期化、管理
// 絵画はしない
export class PieChart {
  readonly arc: d3.Arc<unknown, d3.PieArcDatum<MergedLangStats>>;
  readonly pie: d3.Pie<any, MergedLangStats>;
  readonly pieData: d3.PieArcDatum<MergedLangStats>[];

  constructor(MergedLangStats: MergedLangStats[], radius: number) {
    this.arc = d3
      .arc<d3.PieArcDatum<MergedLangStats>>()
      // アニメーションで一部のパスが反転するためドーナツ型にはしない
      // ドーナツ型にすると中央の穴のパスが悪影響する
      .innerRadius(0)
      .outerRadius(radius)
      .padAngle(0.01)
      .padRadius(radius);

    this.pie = d3
      .pie<MergedLangStats>()
      .value((d) => d.repoCount)
      .sort((a, b) => b.repoCount - a.repoCount);

    this.pieData = this.pie(MergedLangStats);
  }

  // arcのpathとラベルの座標を返却
  getTarget(d: d3.PieArcDatum<MergedLangStats>) {
    const pos = this.arc.centroid(d);
    return {
      path: this.arc(d) || "",
      labelX: pos[0],
      labelY: pos[1],
    };
  }
}
