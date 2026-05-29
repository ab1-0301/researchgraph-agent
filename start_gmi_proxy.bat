@echo off

setlocal
cd /d "%~dp0"

if not exist "gmi-proxy.env" (
  echo Missing gmi-proxy.env. Create it with OPENAI_API_KEY=your_GMI_token
  pause
  exit /b 1
)

for /f "usebackq tokens=1,* delims==" %%A in ("gmi-proxy.env") do (
  if "%%A"=="OPENAI_API_KEY" set "OPENAI_API_KEY=%%B"
)

if "%OPENAI_API_KEY%"=="" (
  echo OPENAI_API_KEY is empty in gmi-proxy.env
  pause
  exit /b 1
)

echo Starting GMI LiteLLM proxy on http://localhost:4000
echo Model alias: deepseek-gmi
echo Do not close this window while using Claude Code through GMI.
".venv-litellm\Scripts\litellm.exe" --config "gmi-litellm-config.yaml" --host 0.0.0.0 --port 4000 --drop_params
pause
