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

// グラフの共通データ構造
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

// データ初期化
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
const pastelColors: string[] = JSON.parse(container.dataset.colors ?? "[]");

const mergedLangStats: MergedLangStats[] = langCount.map((stat, i) => {
  const byteInfo = langBytes.find((b) => b.name === stat.name);
  return {
    langName: stat.name,
    langColor: pastelColors[i % pastelColors.length],
    repoCount: stat.count,
    repoBytes: byteInfo ? byteInfo.bytes : 0,
  };
});

// SVG・定数
const width = 600;
const height = 500;
const margin = 80;
const radius = Math.min(width, height) / 2 - 60;

const svgMain = d3
  .select("#unified-chart")
  .append("svg")
  .attr("width", width)
  .attr("height", height);
const gMain = svgMain.append("g");

// 共通の軸スタイル定義
// 以降、スタイルの適用については style を利用せず、attr でTailwindCSSのclassを付与する形で実装する
// ただし、アニメーションする部分についてはgsapがoklchに対応していないため注意
const styleAxis = (
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

// -------------------------
// チャート生成
// -------------------------
const pieChart = new PieChart(mergedLangStats, radius);
const barChart = new BarChart(svgMain, mergedLangStats, width, height, margin);
const stackChart = new StackChart(
  svgMain,
  mergedLangStats,
  commitData,
  width,
  height,
  margin,
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
  .attr("d", pieChart.arc)
  .attr("fill", (d) => d.data.langColor)
  .attr("fill-opacity", 0.2)
  .attr("stroke", (d) => d.data.langColor)
  .attr("stroke-opacity", 0.5)
  .attr("stroke-width", 2);

// label定義
const labels = elements
  .append("text")
  .style("text-anchor", "middle")
  .attr("class", "text-xs fill-current select-none");
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
// labelの位置を初期化
elements.each(function (d) {
  const target = pieChart.getTarget(d);
  gsap.set(d3.select(this).select("text").node(), {
    x: target.labelX,
    y: target.labelY,
  });
});

// Bar Graph用Tooltip定義
const tooltip = d3
  .select("body")
  .append("div")
  .attr(
    "class",
    "fixed invisible pointer-events-none z-50 rounded-md border p-2 text-xs shadow-lg bg-white/95 border-slate-200 text-slate-700 dark:bg-slate-900/95 dark:border-slate-700 dark:text-slate-200 backdrop-blur-sm transition-opacity duration-200",
  )
  .style("position", "absolute");

elements
  .on("mouseover", (event, d) => {
    const mode = d3
      .select('input[name="chart-type"]:checked')
      .property("value");
    if (mode === "bar") {
      const kb = (d.data.repoBytes / 1024).toFixed(2);
      // Tooltipのcolor等は動的に適用
      tooltip.style("visibility", "visible").html(`
        <span style="color: ${d.data.langColor}">●</span> 
        <span class="font-bold">${d.data.langName}</span>: ${kb} KB
      `);
    }
  })
  .on("mousemove", (event) => {
    const [mx, my] = d3.pointer(event, document.body);
    tooltip.style("top", `${my - 10}px`).style("left", `${mx + 10}px`);
  })
  .on("mouseleave", () => tooltip.style("visibility", "hidden"));

// -------------------------
// GSAPアニメーション
// -------------------------
let isAnimating = false;

const updateChart = (type: ChartType) => {
  if (isAnimating) return;

  const inputs = document.querySelectorAll<HTMLInputElement>(
    'input[name="chart-type"]',
  );
  const radioLabels = document.querySelectorAll<HTMLElement>(".radio-label");

  const masterTl = gsap.timeline({
    onStart: () => {
      isAnimating = true;
      inputs.forEach((i) => (i.disabled = true));
      radioLabels.forEach((el) => (el.style.opacity = "0.5"));
    },
    onComplete: () => {
      isAnimating = false;
      inputs.forEach((i) => (i.disabled = false));
      radioLabels.forEach((el) => (el.style.opacity = "1"));
    },
  });

  // Stackのボーダーラインは非Stack時に事前フェードアウト
  if (type !== ChartType.Stack) {
    masterTl.to(stackChart.borderPath.node(), {
      opacity: 0,
      duration: 0.2,
      ease: "power2.in",
    });
  }
  // ソート（チャート切り替え時にデータ順を更新）
  if (type === ChartType.Bar)
    mergedLangStats.sort((a, b) => a.repoBytes - b.repoBytes);
  else if (type === ChartType.Pie)
    mergedLangStats.sort((a, b) => b.repoCount - a.repoCount);

  // Stack用: bytesの降順インデックスを事前計算
  const sortedByImpact = [...mergedLangStats].sort(
    (a, b) => b.repoBytes - a.repoBytes,
  );

  const elementTl = gsap.timeline();

  elements.each(function (d) {
    const g = this;
    const pathNode = d3.select(g).select("path").node() as SVGPathElement;
    const textNode = d3.select(g).select("text").node() as SVGTextElement;
    const nameLabel = d3.select(textNode).select(".name-label").node();
    const percentLabel = d3.select(textNode).select(".percent-label").node();

    if (type === ChartType.Pie) {
      const target = pieChart.getTarget(d);

      elementTl.to(
        [
          stackChart.gStackXAxis.node(),
          stackChart.gStackYAxis.node(),
          barChart.gXAxis.node(),
          barChart.gYAxis.node(),
        ],
        { opacity: 0, duration: 0.3 },
        0,
      );
      elementTl.to(percentLabel, { opacity: 1, duration: 0.4, delay: 0.4 }, 0);
      elementTl.to(nameLabel, { attr: { dy: "-0.2em" }, duration: 0.8 }, 0);
      elementTl.to(
        g,
        { x: width / 2, y: height / 2, duration: 0.8, ease: "power2.inOut" },
        0,
      );
      elementTl.to(
        pathNode,
        {
          morphSVG: target.path,
          attr: {
            fill: d.data.langColor,
            stroke: d.data.langColor,
          },
          duration: 0.8,
          ease: "power2.inOut",
        },
        0,
      );
      elementTl.to(
        textNode,
        {
          x: target.labelX,
          y: target.labelY,
          opacity: 1,
          duration: 0.8,
          ease: "power2.inOut",
        },
        0,
      );
    } else if (type === ChartType.Bar) {
      barChart.updateAxes(styleAxis);
      const target = barChart.getTarget(d);

      elementTl.to(
        [stackChart.gStackXAxis.node(), stackChart.gStackYAxis.node()],
        { opacity: 0, duration: 0.3 },
        0,
      );
      elementTl.to(
        [barChart.gXAxis.node(), barChart.gYAxis.node()],
        { opacity: 1, duration: 0.8 },
        0,
      );
      elementTl.to(percentLabel, { opacity: 0, duration: 0.4 }, 0);
      elementTl.to(nameLabel, { attr: { dy: "0.35em" }, duration: 0.8 }, 0);
      elementTl.to(
        g,
        {
          x: target.elementX,
          y: target.elementY,
          duration: 0.8,
          ease: "power2.inOut",
        },
        0,
      );
      elementTl.to(
        pathNode,
        {
          // -8～8の値でアニメーションのパス移動を制御可能
          // グラフの形は動的なため手動で設定はしない
          morphSVG: { shape: target.path, shapeIndex: "auto" },
          attr: {
            fill: d.data.langColor,
            stroke: d.data.langColor,
          },
          duration: 0.8,
          ease: "power2.inOut",
        },
        0,
      );
      elementTl.to(
        textNode,
        {
          x: target.labelX,
          y: target.labelY,
          opacity: 1,
          duration: 0.8,
          ease: "power2.inOut",
        },
        0,
      );
    } else if (type === ChartType.Stack) {
      const stableIndex = sortedByImpact.findIndex(
        (m) => m.langName === d.data.langName,
      );
      const target = stackChart.getTarget(d, stableIndex);

      elementTl.to(
        [barChart.gXAxis.node(), barChart.gYAxis.node()],
        { opacity: 0, duration: 0.3 },
        0,
      );
      elementTl.to(
        [stackChart.gStackXAxis.node(), stackChart.gStackYAxis.node()],
        { opacity: 1, duration: 0.8 },
        0,
      );
      elementTl.to(g, { x: 0, y: 0, duration: 0.8, ease: "power2.inOut" }, 0);
      elementTl.to(
        pathNode,
        {
          morphSVG: target.path,
          attr: {
            fill: "#ad46ff",
            fillOpacity: 0.5,
            stroke: "none",
          },
          duration: 0.8,
          ease: "power2.inOut",
        },
        0,
      );
      elementTl.to(
        textNode,
        {
          x: target.labelX,
          y: target.labelY,
          opacity: 0,
          duration: 0.8,
          ease: "power2.inOut",
        },
        0,
      );
    }
  });

  masterTl.add(elementTl);

  if (type === ChartType.Stack) {
    masterTl.to(stackChart.borderPath.node(), { opacity: 1 });
  }
};

// -------------------------
// イベント
// -------------------------
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
