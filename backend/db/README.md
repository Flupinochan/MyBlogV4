# Database (Atlas + PostgreSQL)

## ファイル構成

```bash
db/
├── atlas.hcl                   # 接続設定・Atlas Cloud 連携設定
└── migrations/
    ├── atlas.sum               # チェックサム（自動生成・コミット対象・手動編集禁止）
    ├── 20260529000001_*.sql    # テーブル定義v1
    └── 20260529000002_*.sql    # テーブル定義v2
```

## 前提

```bash
# Atlas CLI のインストール
curl -sSf https://atlasgo.sh | sh

# Atlas Cloud へのログイン
atlas login

# 環境変数の設定
export POSTGRESQL_URL="postgresql://user:pass@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require"
```

## マイグレーション手順

### 1. SQL ファイルを作成

変更内容は任意だが、日付はフォーマットに従う必要があるため注意

```
migrations/YYYYMMDDHHMMSS_<変更内容>.sql
例: migrations/20260530000001_add_user_table.sql
```

### 2. チェックサム更新 → push → DB適用

```bash
cd backend/db
atlas migrate hash
atlas migrate push myblogv4 --dev-url "docker://postgres/16/dev"
atlas migrate apply --env prod
```

### 状態を確認

```bash
atlas migrate status --env prod
```

## 補足

### dev-url の PostgreSQL バージョンについて

Neon は PostgreSQL 18 で利用しているが、Atlas は 16 までの対応のため `docker://postgres/16/dev` を使用  
dev-url は SQL 構文検証のみに使われる一時 DB であり、現在の migration SQL はすべて標準 SQL のため 16 での検証で問題ない  
18 固有の構文を migration で使う場合は再検討が必要

### apply 失敗後に再実行するとエラーになる場合

`atlas migrate apply` が途中で失敗すると `atlas_schema_revisions` スキーマが Neon 上に残り、次回 apply 時に以下のエラーが出力された

```
Error: sql/migrate: connected database is not clean: found schema "atlas_schema_revisions".
baseline version or allow-dirty is required
```

Neon コンソールの SQL エディタで以下を実行してから再実行

```sql
DROP SCHEMA atlas_schema_revisions CASCADE;
```

### WSL2 で時刻ずれエラーが発生する場合

`atlas migrate push` 実行時に以下のエラーが出た場合、WSL2 の時刻がズレが原因

```
Error: restore dev-database snapshot: postgres: querying schema "public" check constraints:
pq: remote wall time is too far ahead to be trustworthy
```

以下のコマンドで時刻を同期してから再実行

```bash
sudo timedatectl set-ntp true
sudo systemctl restart systemd-timesyncd
```
