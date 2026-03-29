# agentが使用したツール名をログ出力するフック
$inputJson = Get-Content -Raw
$data = $inputJson | ConvertFrom-Json

$logDir = "./log"
if (!(Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

$sessionId = if ($data.session_id) { $data.session_id } else { "unknown" }
$toolName  = if ($data.tool_name)  { $data.tool_name }  else { "unknown" }

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$logFile = "$logDir/$sessionId.log"

Add-Content -Path $logFile -Value "[$timestamp] tool_name: $toolName"

# デバッグしたい場合は、以下でinputをファイルに保存して確認可能
# Get-Content -Raw | Set-Content hook-input.json