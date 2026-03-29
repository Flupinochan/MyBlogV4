#!/usr/bin/env bash

# agentが使用したツール名をログ出力するフック
set -euo pipefail

INPUT=$(cat)

LOG_DIR="./log"
mkdir -p "$LOG_DIR"

SESSION_ID=$(printf '%s' "$INPUT" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)
TOOL_NAME=$(printf '%s' "$INPUT" | sed -n 's/.*"tool_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)

SESSION_ID=${SESSION_ID:-unknown}
TOOL_NAME=${TOOL_NAME:-unknown}

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
LOG_FILE="$LOG_DIR/${SESSION_ID}.log"

echo "[$TIMESTAMP] tool_name: $TOOL_NAME" >> "$LOG_FILE"

# デバッグしたい場合は、以下でinputをファイルに保存して確認可能
# cat > hook-input.json