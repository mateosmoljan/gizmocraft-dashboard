export function buildScreenshotSyncHelperScript({ player, baseUrl }: { player: string; baseUrl: string }) {
  const safePlayer = player.replace(/'/g, "''");
  const safeBaseUrl = baseUrl.replace(/'/g, "''").replace(/\/$/, "");

  return String.raw`param(
  [string]$Player = '${safePlayer}',
  [string]$ScreenshotsDir = "$env:APPDATA\.minecraft\screenshots",
  [string]$BaseUrl = '${safeBaseUrl}'
)

$ErrorActionPreference = 'Stop'
$StateDir = Join-Path $env:LOCALAPPDATA 'GizmoCraft'
$StatePath = Join-Path $StateDir "screenshot-sync-$Player.json"
$UploadUrl = "$BaseUrl/api/screenshots/upload"
$AllowedExtensions = @('.png', '.jpg', '.jpeg', '.webp')

New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
if (!(Test-Path $ScreenshotsDir)) {
  Write-Host "Minecraft screenshot folder not found: $ScreenshotsDir"
  Write-Host "Take a screenshot in Minecraft first, or pass -ScreenshotsDir with the right path."
  exit 1
}

function Read-State {
  if (Test-Path $StatePath) {
    try { return Get-Content $StatePath -Raw | ConvertFrom-Json -AsHashtable } catch {}
  }
  return @{}
}

function Write-State($State) {
  $State | ConvertTo-Json | Set-Content -Path $StatePath -Encoding UTF8
}

function Get-ContentType($Path) {
  switch ([IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    '.jpg' { 'image/jpeg'; break }
    '.jpeg' { 'image/jpeg'; break }
    '.webp' { 'image/webp'; break }
    default { 'image/png' }
  }
}

function Send-Screenshot($Path) {
  $client = [System.Net.Http.HttpClient]::new()
  $form = [System.Net.Http.MultipartFormDataContent]::new()
  $fileStream = [System.IO.File]::OpenRead($Path)
  try {
    $fileContent = [System.Net.Http.StreamContent]::new($fileStream)
    $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse((Get-ContentType $Path))
    $form.Add([System.Net.Http.StringContent]::new($Player), 'player')
    $form.Add($fileContent, 'screenshot', [IO.Path]::GetFileName($Path))
    $response = $client.PostAsync($UploadUrl, $form).GetAwaiter().GetResult()
    if (!$response.IsSuccessStatusCode) {
      $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
      throw "Upload failed $([int]$response.StatusCode): $body"
    }
  } finally {
    $fileStream.Dispose()
    $form.Dispose()
    $client.Dispose()
  }
}

Write-Host "GizmoCraft screenshot sync running for $Player"
Write-Host "Watching: $ScreenshotsDir"
Write-Host "Uploading to: $UploadUrl"
Write-Host "Keep this window open while playing. Press Ctrl+C to stop."

$State = Read-State
while ($true) {
  Get-ChildItem -Path $ScreenshotsDir -File | Where-Object { $AllowedExtensions -contains $_.Extension.ToLowerInvariant() } | Sort-Object LastWriteTimeUtc | ForEach-Object {
    $key = "$($_.Name):$($_.Length):$($_.LastWriteTimeUtc.Ticks)"
    if (!$State.ContainsKey($key)) {
      try {
        Send-Screenshot $_.FullName
        $State[$key] = (Get-Date).ToUniversalTime().ToString('o')
        Write-State $State
        Write-Host "Uploaded $($_.Name)"
      } catch {
        Write-Host "Could not upload $($_.Name): $_"
      }
    }
  }
  Start-Sleep -Seconds 2
}
`;
}
