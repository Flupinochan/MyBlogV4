# Database (Atlas + Neon PostgreSQL)

## ファイル構成

```bash
lib/lambda/voicevox/
├── atlas.hcl               # Atlas設定
└── src/
    └── models.py           # SQLAlchemy モデル (Schema Source of Truth)
```

## 前提

```bash
# Atlas CLI のインストール
curl -sSf https://atlasgo.sh | sh

# Atlas SQLAlchemy Provider のインストール
uv tool install atlas-provider-sqlalchemy

# Atlas Cloud へのログイン
atlas login

# dockerが起動していること
docker ps

# 環境変数の設定
export ATLAS_DB_URL="postgresql://user:pass@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require"

## .envから読み込む場合
cd backend/lib/lambda/voicevox
set -a && source .env && set +a
```

## Declarative Schema Migrations

### 1. `src/models.py` の SQLAlchemy モデルを編集

テーブル追加・カラム変更などあるべき状態を SQLAlchemy モデルに記載

### 2. Atlasスキーマに一致するようにDatabaseを更新

```bash
# ファイルの整形/構文チェック
atlas schema fmt --env prod
atlas schema lint --env prod
atlas schema validate --env prod
# Atlas Cloudにapply用のSQLやテーブルのER図を保存
atlas schema plan --env prod
atlas schema push --env prod
# 実行される SQL を表示
atlas schema apply --env prod --dry-run
# Test実行、PASSならOK
atlas schema test --env prod
# Database更新
atlas schema apply --env prod
```

その他のコマンド

```bash
atlas schema inspect --env prod
atlas schema diff --env prod --from xxx --to yyy
atlas schema stats --env prod
# Database削除
atlas schema clean --env prod
```

## 補足

### バージョン管理方式と宣言的方式のコマンドの違い

|           | バージョン管理方式        | 宣言的方式 (本プロジェクト) |
| --------- | ------------------------- | --------------------------- |
| コマンド  | `atlas migrate`           | `atlas schema`              |
| 管理対象  | `migrations/*.sql`        | `schema/*.sql`              |
| atlas.hcl | `migration { dir = ... }` | `src = [...]`               |

### dev-url の PostgreSQL バージョンについて

Neon は PostgreSQL 18 で利用しているが、Atlas は 16 までの対応のため `docker://postgres/16/dev` を使用  
dev-url は差分計算時に Atlas が内部で使う一時 DB であり、現在の schema SQL はすべて標準 SQL のため 16 での検証で問題ない  
18 固有の構文を使う場合は再検討が必要

### WSL2 で時刻ズレエラーが発生する場合

`atlas schema plan` 実行時に以下のエラーが出た場合、WSL2 の時刻ズレが原因

```
Error: restore dev-database snapshot: postgres: querying schema "public" check constraints:
pq: remote wall time is too far ahead to be trustworthy
```

以下のコマンドで時刻を同期してから再実行

```bash
sudo timedatectl set-ntp true
sudo systemctl restart systemd-timesd
```
