k6 テスト計画 — MyBlogV4

Context

MyBlogV4 は Astro 6 + React 19 のフロントエンドと、AWS Lambda ベースの2つのバックエンド API
で構成されるブログサービス。

- Blog Search API (Go + Huma v2 + OpenSearch): ブログ記事の一覧取得・全文/ベクター/ハイブリッド検索
- VoiceVox Chat API (Python + FastAPI + AWS Bedrock + VoiceVox): AI チャット + 音声合成

ユーザーの主要なジャーニーはブログ検索とAIチャットの2本柱。
API Gateway のスロットリングが 10 req/sec / burst 10 と低い点が設計上の重要制約。

---
System Overview

User → Astro Frontend
         ├── BlogSection (React) → GET /opensearch-api/v1/blogs
         │                       → GET /opensearch-api/v1/topics
         │                       → GET /opensearch-api/v1/blogs/{slug}
         └── ChatSection (React) → POST /voicevox-api/v1/chat
                                 → POST /voicevox-api/v1/chat/voice

インフラ制約:
- API Gateway: 10 req/sec rate, 10 burst limit (両 API 共通)
- Lambda: コールドスタートあり
- AWS Bedrock: Nova Micro (LLM) + Titan Embed v2 (embedding) — コスト考慮
- VoiceVox: 音声合成のため /chat/voice は /chat より応答が遅い

---
Test Matrix

┌────────────────────────┬──────────────┬───────────────────┬─────────────────┬────────────┐
│          目的          │ テストタイプ │       対象        │     スキル      │   優先度   │
├────────────────────────┼──────────────┼───────────────────┼─────────────────┼────────────┤
│ 基本動作確認           │ Smoke        │ 全エンドポイント  │ k6-smoke-test   │ 1 (最優先) │
├────────────────────────┼──────────────┼───────────────────┼─────────────────┼────────────┤
│ 通常トラフィック耐性   │ Load         │ Blog Search API   │ k6-load-test    │ 2          │
├────────────────────────┼──────────────┼───────────────────┼─────────────────┼────────────┤
│ チャット同時接続       │ Load         │ VoiceVox Chat API │ k6-load-test    │ 3          │
├────────────────────────┼──────────────┼───────────────────┼─────────────────┼────────────┤
│ スロットリング境界確認 │ Stress       │ Blog Search API   │ k6-load-test    │ 4          │
├────────────────────────┼──────────────┼───────────────────┼─────────────────┼────────────┤
│ Lambda 安定性          │ Soak         │ Blog Search API   │ k6-load-test    │ 5          │
├────────────────────────┼──────────────┼───────────────────┼─────────────────┼────────────┤
│ E2E ブログ検索体験     │ Browser      │ / (ホームページ)  │ k6-browser-test │ 6          │
└────────────────────────┴──────────────┴───────────────────┴─────────────────┴────────────┘

---
Per-Test Details

1. smoke-test.js — スモークテスト

Type: Smoke
Target: 全エンドポイント (両 API)

Scenarios:
- VUs: 1
- Duration: 30s
- executor: per-vu-iterations, iterations: 1

エンドポイント:
GET  /opensearch-api/v1/health
GET  /opensearch-api/v1/health/opensearch
GET  /opensearch-api/v1/blogs?limit=5
GET  /opensearch-api/v1/topics
GET  /voicevox-api/v1/health
POST /voicevox-api/v1/chat  (messages: [{role: "user", content: "こんにちは"}])

Thresholds:
- http_req_failed < 1% (エラーなし)
- http_req_duration < 5000ms (p95)

Dependencies: 本番または dev 環境の稼働

---
2. blog-search-load-test.js — ブログ検索 負荷テスト

Type: Load
Target: Blog Search API

Scenarios (ramping-vus):
0s  →  1 VU  (ウォームアップ)
30s →  3 VUs (定常: ~6 req/sec、スロットリング余裕あり)
2m  →  3 VUs
30s →  0 VU  (クールダウン)
※ 3 VUs × ~2 req/iter = ~6 req/sec → API Gateway 10 req/sec 制限内

各 VU のシナリオ:
1. GET /v1/topics (トピック一覧取得)
2. GET /v1/blogs?limit=10 (初期ロード)
3. GET /v1/blogs?limit=10&query=TypeScript&search_mode=fulltext
4. GET /v1/blogs?limit=10&query=TypeScript&search_mode=vector
5. GET /v1/blogs?limit=5&cursor={prev_cursor} (ページネーション)

Thresholds:
- http_req_failed < 1%
- http_req_duration{expected_response:true} p(95) < 3000ms
- http_req_duration{expected_response:true} p(99) < 5000ms

---
3. chat-load-test.js — チャット API 負荷テスト

Type: Load
Target: VoiceVox Chat API

Scenarios:
0s  →  1 VU
30s →  2 VUs (定常: ~4 req/sec)
3m  →  2 VUs
30s →  0 VU
※ Bedrock 課金とレート制限を考慮し VU を抑制

各 VU のシナリオ (マルチターン):
1. POST /v1/chat (1ターン目: "このブログについて教えて")
2. POST /v1/chat (2ターン目: 履歴付き返答)
3. POST /v1/chat/voice (音声合成付き)

Thresholds:
- http_req_failed < 5% (LLM 側エラー考慮でやや緩め)
- http_req_duration{url:*/chat} p(95) < 10000ms
- http_req_duration{url:*/chat/voice} p(95) < 20000ms (音声合成のため長め)

---
4. blog-search-stress-test.js — ブログ検索 ストレステスト

Type: Stress
Target: Blog Search API

目的: API Gateway スロットリング (10 req/sec) を意図的に超えたときの挙動確認。429
レスポンスが適切に返るか検証。

Scenarios (ramping-arrival-rate):
0s  →  5  req/sec  (スロットリング内)
30s → 10  req/sec  (スロットリング境界)
30s → 15  req/sec  (スロットリング超過)
30s →  0  req/sec

Thresholds:
- http_req_duration p(95) < 5000ms (スロットリング時も含む)
- checks{status_is_200_or_429} > 99% (正常または 429 以外のエラーがないこと)

---
5. blog-search-soak-test.js — ブログ検索 ソークテスト

Type: Soak
Target: Blog Search API

目的: Lambda の長時間実行安定性・OpenSearch 接続のリーク確認

Scenarios:
0s  →  2 VUs
2m  →  2 VUs (定常)
30m →  2 VUs
2m  →  0 VU

Thresholds:
- http_req_failed < 1%
- http_req_duration p(95) < 4000ms (時間経過で劣化しないこと)

---
6. blog-browser-test.js — E2E ブラウザテスト (ブログ検索ジャーニー)

Type: Browser
Target: ホームページ → ブログ検索セクション

シナリオ:
1. https://blog.metalmental.net/ にアクセス
2. ブログセクションが表示されるまで待機 (client:idle ハイドレーション)
3. 検索ボックスに "TypeScript" 入力
4. 検索結果カードが表示されることを確認
5. トピックフィルターを選択
6. フィルター適用後の結果確認
7. Core Web Vitals (LCP, CLS, FID) を取得

Thresholds:
- browser_web_vital_lcp p(75) < 2500ms (Good 基準)
- browser_web_vital_cls p(75) < 0.1

---
Execution Order

1. [必須] smoke-test.js           (~1 min)   — 環境正常性確認
2. [単独] blog-search-load-test.js (~3 min)   — 通常負荷
3. [単独] chat-load-test.js        (~4 min)   — チャット負荷 (コスト注意)
4. [単独] blog-search-stress-test.js (~2 min) — スロットリング確認
5. [任意] blog-browser-test.js     (~3 min)   — E2E UI 確認
6. [任意] blog-search-soak-test.js (~35 min)  — 長時間安定性

- テスト 2〜4 は並列実行可能だが、API Gateway スロットリングが共有リソースのため 逐次実行を推奨
- ソークテスト (6) はコスト・時間の理由から定期CI ではなくリリース前のみ実行

---
環境変数 (全テスト共通)

BASE_URL_SEARCH=https://blog.metalmental.net/opensearch-api
BASE_URL_CHAT=https://blog.metalmental.net/voicevox-api
# または dev 環境
BASE_URL_SEARCH=https://dev-blog.metalmental.net/opensearch-api
BASE_URL_CHAT=https://dev-blog.metalmental.net/voicevox-api

---
Verification
シナリオ:
1. https://blog.metalmental.net/ にアクセス
2. ブログセクションが表示されるまで待機 (client:idle ハイドレーション)
3. 検索ボックスに "TypeScript" 入力
4. 検索結果カードが表示されることを確認
5. トピックフィルターを選択
6. フィルター適用後の結果確認
7. Core Web Vitals (LCP, CLS, FID) を取得

Thresholds:
- browser_web_vital_lcp p(75) < 2500ms (Good 基準)
- browser_web_vital_cls p(75) < 0.1

---
Execution Order

1. [必須] smoke-test.js           (~1 min)   — 環境正常性確認
2. [単独] blog-search-load-test.js (~3 min)   — 通常負荷
3. [単独] chat-load-test.js        (~4 min)   — チャット負荷 (コスト注意)
4. [単独] blog-search-stress-test.js (~2 min) — スロットリング確認
5. [任意] blog-browser-test.js     (~3 min)   — E2E UI 確認
6. [任意] blog-search-soak-test.js (~35 min)  — 長時間安定性

- テスト 2〜4 は並列実行可能だが、API Gateway スロットリングが共有リソースのため 逐次実行を推奨
- ソークテスト (6) はコスト・時間の理由から定期CI ではなくリリース前のみ実行

---
環境変数 (全テスト共通)

BASE_URL_SEARCH=https://blog.metalmental.net/opensearch-api
BASE_URL_CHAT=https://blog.metalmental.net/voicevox-api
# または dev 環境
BASE_URL_SEARCH=https://dev-blog.metalmental.net/opensearch-api
BASE_URL_CHAT=https://dev-blog.metalmental.net/voicevox-api

---
Verification

# スモークテスト実行
k6 run smoke-test.js -e BASE_URL_SEARCH=... -e BASE_URL_CHAT=...

# 負荷テスト実行
k6 run blog-search-load-test.js -e BASE_URL_SEARCH=...

# k6 MCP でのバリデーション
mcp__k6__validate_script  # 各スクリプトを事前検証
mcp__k6__run_script       # ローカル実行 (Grafana k6 Cloud 不使用)
