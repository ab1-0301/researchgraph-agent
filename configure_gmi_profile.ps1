$profilePath = $PROFILE
$profileDir = Split-Path -Parent $profilePath

if (!(Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

if (!(Test-Path $profilePath)) {
    New-Item -ItemType File -Path $profilePath -Force | Out-Null
}

$content = Get-Content $profilePath -Raw
if ($null -eq $content) { $content = '' }
$block = @'

function gmi {
    $env:ANTHROPIC_BASE_URL = "http://localhost:4000"
    $env:ANTHROPIC_AUTH_TOKEN = "sk-placeholder"
    $env:ANTHROPIC_MODEL = "deepseek-gmi"
    $env:ANTHROPIC_SMALL_FAST_MODEL = "deepseek-gmi"
    $env:PATH = "C:\Program Files\Lenovo\AIAgent\mcp\node-v22.16.0-win-x64;$env:PATH"
    if (Get-Command claude -ErrorAction SilentlyContinue) {
        claude @args
    } else {
        Write-Error "Please install Claude Code first: npm install -g @anthropic-ai/claude-code"
    }
}
'@

if ($content -notmatch 'function\s+gmi\s*\{') {
    Add-Content -Path $profilePath -Value $block
    Write-Output 'added_gmi_function'
} else {
    Write-Output 'gmi_function_already_exists'
}

Write-Output $profilePath
