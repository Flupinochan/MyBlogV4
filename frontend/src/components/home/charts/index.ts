import * as d3 from "d3";
import type {
  GitHubCommitCount,
  LanguageRepositoryBytes,
  LanguageRepositoryCount,
} from "../../../types/github";
import { gsap } from "../../lib/gsap";
import { BarChart } from "./barChart";
import { PieChart } from "./pieChart";
import { StackChart } from "./stackChart";
import { Tooltip } from "./tooltip";
// [注意事項]
// スタイルの適用については style を利用せず
// attr で TailwindCSS の class を付与する形で実装
// ただし、gsapアニメーションする部分についてはgsapがoklchに対応していなくエラーになるためhexで定義すること

// PieとBar Chart共通データ構造
export interface MergedLangStats {
  langName: string;
  langColor: string;
  repoCount: number;
  repoBytes: number;
}

// チャート種別
enum ChartType {
  Pie = "pie",
  Bar = "bar",
  Stack = "stack",
}

// データ取得、初期化
const container = document.getElementById("unified-chart");
if (!container) throw new Error("Container not found");

const langCount: LanguageRepositoryCount[] = JSON.parse(
  container.dataset.stats ?? "[]",
);
const langBytes: LanguageRepositoryBytes[] = JSON.parse(
  container.dataset.bytes ?? "[]",
);
const commitData: GitHubCommitCount[] = JSON.parse(
  container.dataset.commits ?? "[]",
);

const langColorMap: Record<string, string> = {
  Dart: "#00bc7d",
  "C#": "#9810fa",
  Rust: "#ff6900",
  Python: "#f0b100",
  TypeScript: "#00a6f4",
};

// Pie/BarChart用data
const mergedLangStats: MergedLangStats[] = langCount.map((stat, i) => {
  const byteInfo = langBytes.find((b) => b.name === stat.name);
  return {
    langName: stat.name,
    langColor: langColorMap[stat.name] ?? stat.color,
    repoCount: stat.count,
    repoBytes: byteInfo ? byteInfo.bytes : 0,
  };
});
// StackChart用data
const stackOrder = [...mergedLangStats].sort(
  (a, b) => b.repoBytes - a.repoBytes,
);

// 定数
const width = 600;
const height = 500;
const margin = 80;
const radius = Math.min(width, height) / 2 - 60;
// アニメーション
const hideDuration = 0.3;
const showDuration = 0.8;
const hideEase = "power2.in";
const showEase = "power2.out";

// 親要素svg/gタグ
const svgMain = d3
  .select("#unified-chart")
  .append("svg")
  .attr("width", width)
  .attr("height", height);
const gMain = svgMain.append("g");

// axis共通のcolor等のスタイル定義
export type StyleAxisFn = (
  sel: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
) => void;

const styleAxis: StyleAxisFn = (
  selection: d3.Selection<SVGGElement, unknown, HTMLElement, any>,
) => {
  selection
    .selectAll("path, line")
    .attr("class", "stroke-slate-400 dark:stroke-slate-600")
    .attr("stroke-width", 1);
  selection
    .selectAll("text")
    .attr("class", "fill-slate-700 dark:fill-slate-300 font-medium");
};

// Chart設定初期化
const tooltip = new Tooltip();
const pieChart = new PieChart(mergedLangStats, radius);
const barChart = new BarChart(
  svgMain,
  mergedLangStats,
  width,
  height,
  margin,
  tooltip,
  styleAxis,
);
const stackChart = new StackChart(
  svgMain,
  commitData,
  width,
  height,
  margin,
  tooltip,
  styleAxis,
);

// 初期表示のPieChart描画
const elements = gMain
  .selectAll<SVGGElement, d3.PieArcDatum<MergedLangStats>>("g.element")
  .data(pieChart.pieData, (d) => d.data.langName)
  .join("g")
  .attr("class", "element")
  .attr("transform", `translate(${width / 2}, ${height / 2})`);

// color, border定義
elements
  .append("path")
  .attr("class", "opacity-0")
  .attr("d", (d) => {
    // endAngle = startAngleにして非表示
    return d3.arc<any>().innerRadius(0).outerRadius(radius)({
      ...d,
      endAngle: d.startAngle,
    })!;
  })
  .attr("fill", (d) => d.data.langColor)
  .attr("fill-opacity", 0.2)
  .attr("stroke", (d) => d.data.langColor)
  .attr("stroke-opacity", 0.5)
  .attr("stroke-width", 2);

// label定義
const labels = elements
  .append("text")
  .attr(
    "class",
    "opacity-0 text-xs fill-current select-none [text-anchor:middle]",
  );
// language name
labels
  .append("tspan")
  .attr("x", 0)
  .attr("dy", "-0.2em")
  .attr("class", "name-label font-bold")
  .text((d) => d.data.langName);
// repository count
labels
  .append("tspan")
  .attr("x", 0)
  .attr("dy", "1.2em")
  .attr("class", "percent-label font-normal")
  .text((d) => `(${d.data.repoCount})`);
// label position
elements.each(function (d) {
  const target = pieChart.getTarget(d);
  gsap.set(d3.select(this).select("text").node(), {
    x: target.labelX,
    y: target.labelY,
  });
});

let isAnimating = false;

// 初期表示のアニメーション
const innerTl = gsap.timeline({
  onStart: () => {
    isAnimating = true;
  },
  onComplete: () => {
    isAnimating = false;
  },
});
elements.each(function (data, index) {
  const path = d3.select(this).select("path");
  const label = d3.select(this).select("text");
  const staggerStep = 0.15;
  innerTl.to(
    path.node(),
    {
      autoAlpha: 1,
      duration: 0.1,
    },
    index * staggerStep,
  );
  innerTl.to(
    { val: data.startAngle },
    {
      val: data.endAngle,
      duration: 0.5,
      ease: "power2.out",
      onUpdate: function () {
        path.attr(
          "d",
          d3.arc<any>().innerRadius(0).outerRadius(radius)({
            ...data,
            endAngle: this.targets()[0].val,
          })!,
        );
      },
    },
    index * staggerStep,
  );
  innerTl.to(
    label.node(),
    {
      autoAlpha: 1,
      duration: 0.3,
    },
    index * staggerStep + 0.3,
  );
});

// Graph切り替え時のGSAPアニメーション
const updateChart = (type: ChartType) => {
  if (isAnimating) return;

  const radioButtons = document.querySelectorAll<HTMLInputElement>(
    'input[name="chart-type"]',
  );
  const radioLabels = document.querySelectorAll<HTMLElement>(".radio-label");

  // グラフごとにソート順序を切替
  if (type === ChartType.Bar) {
    mergedLangStats.sort((a, b) => a.repoBytes - b.repoBytes);
    barChart.updateAxes(mergedLangStats);
  } else if (type === ChartType.Pie) {
    mergedLangStats.sort((a, b) => b.repoCount - a.repoCount);
  }

  const masterTl = gsap.timeline({
    // アニメーション開始前処理
    onStart: () => {
      isAnimating = true;
      // RadioButtonを無効化
      radioButtons.forEach((i) => (i.disabled = true));
      radioLabels.forEach((el) => (el.style.opacity = "0.5"));
      // EventListener無効化&Tooltip非表示
      tooltip.hide();
    },
    // アニメーション完了後処理
    onComplete: () => {
      isAnimating = false;
      // RadioButtonを有効化
      radioButtons.forEach((i) => (i.disabled = false));
      radioLabels.forEach((el) => (el.style.opacity = "1"));
      // BarChartの時はTooltip表示のためEventListenerを有効化
      if (type === ChartType.Bar) {
        tooltip.attachEvent(elements, (d) => ({
          color: d.data.langColor,
          label: d.data.langName,
          value: `${(d.data.repoBytes / 1024).toFixed(2)} KB`,
        }));
      } else if (type === ChartType.Stack) {
        tooltip.attachEvent(elements, () => ({
          color: stackChart.fillColor,
          label: "Total Commits",
          value: String(stackChart.maxTotal),
        }));
      }
    },
  });

  // 1. StackChartから変形する場合は、最初にBorderをFadeOut
  if (type !== ChartType.Stack) {
    stackChart.hideBorder(masterTl);
  }

  // 2. 各グラフのメインアニメーション
  const elementTl = gsap.timeline();
  elements.each(function (d) {
    const g = this;
    const pathNode = d3.select(g).select("path").node() as SVGPathElement;
    const textNode = d3.select(g).select("text").node() as SVGTextElement;
    const nameLabel = d3.select(textNode).select(".name-label").node();
    const percentLabel = d3.select(textNode).select(".percent-label").node();

    if (type === ChartType.Pie) {
      const target = pieChart.getTarget(d);

      // BartとStackの軸を非表示
      stackChart.hideAxis(elementTl, hideDuration, hideEase);
      barChart.hideAxis(elementTl, hideDuration, hideEase);
      // g
      elementTl.to(
        g,
        { x: width / 2, y: height / 2, duration: showDuration, ease: showEase },
        0,
      );
      // path
      elementTl.to(
        pathNode,
        {
          morphSVG: target.path,
          attr: {
            fill: d.data.langColor,
            stroke: d.data.langColor,
          },
          duration: showDuration,
          ease: showEase,
        },
        0,
      );
      // text position
      elementTl.to(
        textNode,
        {
          x: target.labelX,
          y: target.labelY,
          duration: showDuration,
          ease: showEase,
        },
        0,
      );
      // Label (tspan) opacity
      elementTl.to(
        nameLabel,
        {
          attr: { dy: "-0.2em" },
          opacity: 1,
          duration: showDuration,
          ease: showEase,
        },
        0,
      );
      elementTl.to(
        percentLabel,
        { opacity: 1, duration: showDuration, ease: showEase },
        0,
      );
    } else if (type === ChartType.Bar) {
      const target = barChart.getTarget(d.data);

      // Stackの軸を非表示
      stackChart.hideAxis(elementTl, hideDuration, hideEase);
      // Barの軸を表示
      barChart.showAxis(elementTl, showDuration, showEase);
      // g
      elementTl.to(
        g,
        {
          x: target.elementX,
          y: target.elementY,
          duration: showDuration,
          ease: showEase,
        },
        0,
      );
      // path
      elementTl.to(
        pathNode,
        {
          // -8～8の値でアニメーションのパス移動を制御可能
          // グラフの形は動的なため手動で設定せず、デフォルトのautoを利用
          morphSVG: { shape: target.path, shapeIndex: "auto" },
          attr: {
            fill: d.data.langColor,
            stroke: d.data.langColor,
          },
          duration: showDuration,
          ease: showEase,
        },
        0,
      );
      // text position
      elementTl.to(
        textNode,
        {
          x: target.labelX,
          y: target.labelY,
          duration: showDuration,
          ease: showEase,
        },
        0,
      );
      // Label (tspan) opacity
      // percentLabelは非表示
      elementTl.to(
        percentLabel,
        { opacity: 0, duration: hideDuration, ease: hideEase },
        0,
      );
      elementTl.to(
        nameLabel,
        {
          opacity: 1,
          attr: { dy: "0.35em" },
          duration: showDuration,
          ease: showEase,
        },
        0,
      );
    } else if (type === ChartType.Stack) {
      const stableIndex = stackOrder.findIndex(
        (m) => m.langName === d.data.langName,
      );
      const target = stackChart.getTarget(mergedLangStats, stableIndex);

      // Barの軸を非表示
      barChart.hideAxis(elementTl, hideDuration, hideEase);
      // Stackの軸を表示
      stackChart.showAxis(elementTl, showDuration, showEase);
      // g
      elementTl.to(
        g,
        { x: 0, y: 0, duration: showDuration, ease: showEase },
        0,
      );
      // path
      elementTl.to(
        pathNode,
        {
          morphSVG: target.path,
          attr: {
            fill: stackChart.fillColor,
            fillOpacity: 0.5,
            stroke: "none",
          },
          duration: showDuration,
          ease: showEase,
        },
        0,
      );
      // text position
      elementTl.to(
        textNode,
        {
          x: target.labelX,
          y: target.labelY,
          duration: showDuration,
          ease: showEase,
        },
        0,
      );
      // Label (tspan) opacity 非表示
      elementTl.to(
        nameLabel,
        { opacity: 0, duration: hideDuration, ease: hideEase },
        0,
      );
      elementTl.to(
        percentLabel,
        { opacity: 0, duration: hideDuration, ease: hideEase },
        0,
      );
    }
  });
  masterTl.add(elementTl);

  // 3. StackChartに変形する場合は、最後にBorderをFadeIn
  if (type === ChartType.Stack) {
    stackChart.showBorder(masterTl);
  }
};

// Graph切替トリガー
document
  .querySelectorAll<HTMLInputElement>('input[name="chart-type"]')
  .forEach((input) => {
    input.addEventListener("change", (e) => {
      if (isAnimating) {
        e.preventDefault();
        return;
      }
      updateChart((e.target as HTMLInputElement).value as ChartType);
    });
  });
