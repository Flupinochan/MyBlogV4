import { browser } from "k6/browser";
import { check } from "k6";
import { Options } from "k6/options";

export const options: Options = {
  scenarios: {
    browser_test: {
      executor: "shared-iterations",
      options: {
        browser: { type: "chromium" },
      },
      vus: 1,
      iterations: 3,
      maxDuration: "5m",
    },
  },
  thresholds: {
    browser_web_vital_lcp: ["p(75)<2500"],
    browser_web_vital_cls: ["p(75)<0.1"],
    browser_web_vital_fcp: ["p(75)<1800"],
    browser_web_vital_ttfb: ["p(75)<800"],
    browser_web_vital_inp: ["p(75)<200"],
  },
};

const BASE_URL: string = __ENV.BASE_URL ?? "https://blog.metalmental.net";

export default async function (): Promise<void> {
  const page = await browser.newPage();
  try {
    await page.goto(BASE_URL);

    // client:idle ハイドレーション後に DOM 追加を待機
    const searchInput = page.locator("#search");
    await searchInput.waitFor({ state: "attached" });
    // ヘッドレス環境では自動スクロールしないため明示的にスクロールして
    // GSAP ScrollTrigger を発火させ autoAlpha アニメーションを完了させる
    await page.evaluate(() => {
      document.querySelector("#search")?.scrollIntoView({ behavior: "instant" });
    });
    await searchInput.waitFor({ state: "visible" });

    await searchInput.fill("TypeScript");

    const firstCard = page.locator(".blog-carousel a").first();
    await firstCard.waitFor({ state: "visible" });

    const cardCount = await page.locator(".blog-carousel a").count();
    check(cardCount, { "search results visible": (n) => n > 0 });

    // React Query でトピック一覧が取得されるのを待ってからフィルター選択
    await page.locator("#topic-select option").nth(1).waitFor({ state: "attached" });
    await page.locator("#topic-select").selectOption({ index: 1 });
    // networkidle はバックグラウンドアニメーション (particles/Three.js) で到達しないため
    // フィルター適用後のカード表示を直接待機する
    await page.locator(".blog-carousel a").first().waitFor({ state: "visible" });
  } finally {
    await page.close();
  }
}
