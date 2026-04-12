import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const PYTHON_VERSION = "3.13";
const PROJECT_ROOT = resolve(__dirname, ".");

export function buildStaging(platform: string): string {
  // パス定義
  const stagingDir = join(PROJECT_ROOT, ".cache", "staging");
  const pyprojectPath = join(PROJECT_ROOT, "pyproject.toml");

  // クリーン
  rmSync(stagingDir, { recursive: true, force: true });
  mkdirSync(stagingDir, { recursive: true });

  // uvで外部ライブラリをインストール
  const result = spawnSync(
    "uv",
    [
      "pip",
      "install",
      "-r",
      pyprojectPath,
      "--target",
      stagingDir,
      "--python-version",
      PYTHON_VERSION,
      "--python-platform",
      platform,
      "--only-binary",
      ":all:",
    ],
    {
      cwd: PROJECT_ROOT,
      stdio: "pipe",
    },
  );

  if (result.status !== 0) {
    console.error("error:", result.error);
    throw new Error("uv pip install failed");
  }

  // アプリケーションコードコピー
  cpSync(join(PROJECT_ROOT, "src"), stagingDir, { recursive: true });

  return stagingDir;
}
