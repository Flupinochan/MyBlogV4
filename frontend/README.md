
## SVG Iconについて

[heroicons](https://heroicons.com/) や [Lucide](https://lucide.dev/) 推奨  
fillではなくstrokeベースのため、アニメーションや調整がしやすい

## envファイル

GitHubアクセス用のtokenを設定

## Script

ローカル開発時に1度だけ実行、GitHubから毎回APIでデータ取得すると時間がかかるため、ファイルとして保存して再利用

```bash
npm run generate:github-stats
```