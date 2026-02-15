param(
  [switch]$Direct,
  [string]$Message = "Hola desde MercurySolver"
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "== Gemini Test ==" -ForegroundColor Cyan
Write-Host "Working dir: $PWD"
Write-Host "Script dir: $projectRoot"

$envPath = Join-Path $projectRoot ".env"
if (-not (Test-Path $envPath)) {
  Write-Host "No encuentro .env en: $envPath" -ForegroundColor Red
  exit 1
}

$envLines = Get-Content $envPath
$apiKeyLine = $envLines | Where-Object { $_ -match '^GEMINI_API_KEY=' } | Select-Object -First 1
$modelLine = $envLines | Where-Object { $_ -match '^GEMINI_MODEL=' } | Select-Object -First 1

if (-not $apiKeyLine) {
  Write-Host "Falta GEMINI_API_KEY en .env" -ForegroundColor Red
  exit 1
}

$apiKey = ($apiKeyLine -split '=',2)[1].Trim()
$model = if ($modelLine) { ($modelLine -split '=',2)[1].Trim() } else { 'gemini-2.0-flash' }

if ([string]::IsNullOrWhiteSpace($apiKey)) {
  Write-Host "GEMINI_API_KEY está vacía" -ForegroundColor Red
  exit 1
}

Write-Host "Modelo: $model" -ForegroundColor Yellow

if ($Direct) {
  Write-Host "Probando DIRECTO contra Google API..." -ForegroundColor Cyan

  $uri = "https://generativelanguage.googleapis.com/v1beta/models/$model`:generateContent"
  $body = @{
    contents = @(
      @{
        parts = @(
          @{ text = $Message }
        )
      }
    )
  } | ConvertTo-Json -Depth 8

  try {
    $resp = Invoke-RestMethod -Method Post -Uri $uri -Headers @{ 'x-goog-api-key' = $apiKey } -ContentType 'application/json' -Body $body
    Write-Host "OK: respuesta directa recibida" -ForegroundColor Green
    $resp | ConvertTo-Json -Depth 10
  }
  catch {
    Write-Host "ERROR directo" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
      Write-Host $_.ErrorDetails.Message
    } else {
      Write-Host $_.Exception.Message
    }
    exit 1
  }
}
else {
  Write-Host "Probando BACKEND LOCAL http://localhost:8787/api/chat ..." -ForegroundColor Cyan
  Write-Host "Asegurate de tener server corriendo: node server.js" -ForegroundColor DarkYellow

  $body = @{
    message = $Message
    history = @()
    attachments = @()
  } | ConvertTo-Json -Depth 6

  try {
    $resp = Invoke-RestMethod -Method Post -Uri 'http://localhost:8787/api/chat' -ContentType 'application/json' -Body $body
    Write-Host "OK: respuesta local recibida" -ForegroundColor Green
    $resp | ConvertTo-Json -Depth 10
  }
  catch {
    Write-Host "ERROR local" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
      Write-Host $_.ErrorDetails.Message
    } else {
      Write-Host $_.Exception.Message
    }
    exit 1
  }
}
