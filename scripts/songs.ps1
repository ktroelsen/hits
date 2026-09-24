<#
.SYNOPSIS
  Eksportér / importér sange fra HITS-kataloget via admin-API'et (/api/admin/songs/*).

.DESCRIPTION
  Bruges til at berige sange udenfor appen (tags, fun facts …): eksportér en batch,
  ret JSON-filen (fx med Claude Code), og importér den igen. Importen viser altid et
  dry-run først og gemmer kun efter bekræftelse.

  URL og admin-nøgle læses fra .env.local i repo-roden (gitignored):
    HITS_URL=https://din-side.dk
    HITS_ADMIN_KEY=...
  -Url / -Key overskriver dem, fx -Url http://localhost:5259 mod den lokale server.

.EXAMPLE
  .\scripts\songs.ps1 export -Missing tags -Limit 10
  .\scripts\songs.ps1 export -After <id> -Limit 50
  .\scripts\songs.ps1 export -Ids dk-1,dk-2 -Out mine.json
  .\scripts\songs.ps1 export -HasTags -Limit 50
  .\scripts\songs.ps1 import -File songs-export.json
  .\scripts\songs.ps1 import -File songs-export.json -AddTags

  Import: `tags` erstatter sangens tags (med -AddTags lægges de kun til). Felterne
  `addTags` / `removeTags` på en sang tilføjer/fjerner altid uden at røre resten.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory, Position = 0)][ValidateSet('export', 'import')][string]$Command,
  [string]$Url,
  [string]$Key,
  # export
  [string]$Out = 'songs-export.json',
  [int]$Limit,
  [ValidateSet('tags', 'funFact', 'genre')][string]$Missing,
  [switch]$HasTags,
  [string[]]$Ids,
  [string]$Tag,
  [ValidateSet('danish', 'international')][string]$Category,
  [ValidateSet('60s', '70s', '80s', '90s', '00s', '10s', '20s')][string]$Decade,
  [string]$After,
  # import
  [string]$File = 'songs-export.json',
  [switch]$AddTags,
  [switch]$Yes
)

$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)

# ---- config from .env.local ----
$envFile = Join-Path $PSScriptRoot '..\.env.local'
if (Test-Path $envFile) {
  foreach ($line in Get-Content $envFile -Encoding UTF8) {
    if ($line -match '^\s*([A-Z_]+)\s*=\s*"?(.*?)"?\s*$') {
      if ($Matches[1] -eq 'HITS_URL' -and -not $Url) { $Url = $Matches[2] }
      if ($Matches[1] -eq 'HITS_ADMIN_KEY' -and -not $Key) { $Key = $Matches[2] }
    }
  }
}
if (-not $Url) { throw 'Ingen URL. Sæt HITS_URL i .env.local eller brug -Url.' }
$base = $Url.TrimEnd('/') + '/api/admin/songs'
$headers = @{}
if ($Key) { $headers['X-Admin-Key'] = $Key }

# Calls the API and returns the response body as a UTF-8 string, also for 4xx answers
# (the import reports its validation errors with 400).
function Invoke-Api([string]$Method, [string]$Uri, [byte[]]$Body) {
  $req = [System.Net.HttpWebRequest]::Create($Uri)
  $req.Method = $Method
  foreach ($h in $headers.Keys) { $req.Headers[$h] = $headers[$h] }
  if ($Body) {
    $req.ContentType = 'application/json; charset=utf-8'
    $stream = $req.GetRequestStream(); $stream.Write($Body, 0, $Body.Length); $stream.Close()
  }
  try { $res = $req.GetResponse() } catch [System.Net.WebException] {
    $res = $_.Exception.Response
    if (-not $res) { throw }
  }
  $reader = New-Object System.IO.StreamReader($res.GetResponseStream(), $utf8)
  $text = $reader.ReadToEnd(); $reader.Close()
  $status = [int]$res.StatusCode
  if ($status -ge 400 -and $status -ne 400) { throw "HTTP ${status}: $text" }
  return $text
}

if ($Command -eq 'export') {
  $query = @()
  if ($Limit) { $query += "limit=$Limit" }
  if ($Missing) { $query += "missing=$Missing" }
  if ($HasTags) { $query += 'hasTags=true' }
  if ($Ids) { $query += 'ids=' + [uri]::EscapeDataString(($Ids -join ',')) }
  if ($Tag) { $query += 'tag=' + [uri]::EscapeDataString($Tag) }
  if ($Category) { $query += "category=$Category" }
  if ($Decade) { $query += "decade=$Decade" }
  if ($After) { $query += 'after=' + [uri]::EscapeDataString($After) }
  $uri = "$base/export" + $(if ($query) { '?' + ($query -join '&') } else { '' })

  $json = Invoke-Api 'GET' $uri
  $data = $json | ConvertFrom-Json
  if ($data.error) { throw $data.error }
  $path = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $Out))
  [System.IO.File]::WriteAllText($path, $json, $utf8)

  Write-Host "Eksporterede $($data.count) af $($data.total) matchende sange til $path"
  if ($data.nextAfter) { Write-Host "Næste batch: -After $($data.nextAfter)" -ForegroundColor Cyan }
  return
}

# ---- import ----
$path = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $File))
if (-not (Test-Path $path)) { throw "Filen findes ikke: $path" }
$body = [System.IO.File]::ReadAllBytes($path)

function Show-Report($r) {
  if ($r.error) { Write-Host $r.error -ForegroundColor Red }
  if ($r.report) { $r = $r.report }
  foreach ($c in $r.changes) {
    $mark = if ($c.created) { '+' } else { '~' }
    $color = if ($c.created) { 'Green' } else { 'Yellow' }
    Write-Host ("  {0} {1} - {2}: {3}" -f $mark, $c.artist, $c.title, ($c.fields -join ', ')) -ForegroundColor $color
  }
  foreach ($e in $r.errors) { Write-Host ("  ! post #{0}: {1}" -f $e.index, $e.message) -ForegroundColor Red }
  Write-Host ("{0} opdateres, {1} oprettes, {2} uændrede, {3} fejl" -f $r.updated, $r.created, $r.unchanged, @($r.errors).Count)
  return $r
}

Write-Host "Dry-run af $path ..."
$tagMode = if ($AddTags) { 'add' } else { 'replace' }
if ($AddTags) { Write-Host 'Tags i filen lægges til (eksisterende tags bevares).' -ForegroundColor Cyan }
$dry = Show-Report (Invoke-Api 'POST' "$base/import?dryRun=true&tagMode=$tagMode" $body | ConvertFrom-Json)
if ($null -eq $dry.updated) { exit 1 } # bad file (error already printed)
if (@($dry.errors).Count -gt 0) { Write-Host 'Ret fejlene og prøv igen — intet er gemt.' -ForegroundColor Red; exit 1 }
if (($dry.updated + $dry.created) -eq 0) { Write-Host 'Intet at gemme.'; return }

if (-not $Yes) {
  $answer = Read-Host 'Gem? (j/n)'
  if ($answer -notmatch '^(j|ja|y|yes)$') { Write-Host 'Afbrudt — intet er gemt.'; return }
}
$result = Invoke-Api 'POST' "$base/import?tagMode=$tagMode" $body | ConvertFrom-Json
if ($result.saved) { Write-Host "Gemt: $($result.updated) opdateret, $($result.created) oprettet." -ForegroundColor Green }
else { Show-Report $result | Out-Null; exit 1 }
