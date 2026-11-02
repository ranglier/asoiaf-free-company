# Lit les signets d'un PDF produit par Edge et écrit pages.js : { "titre du signet": numéro de page }.
# Sert au sommaire du livret (deux passes dans build.sh). Usage : powershell -File pages.ps1 livret.pdf pages.js
param([string]$pdf, [string]$out)
$raw = [System.Text.Encoding]::GetEncoding(28591).GetString([System.IO.File]::ReadAllBytes($pdf))
$objs = @{}
foreach ($m in [regex]::Matches($raw, '(?s)(\d+) 0 obj(.*?)endobj')) { $objs[[int]$m.Groups[1].Value] = $m.Groups[2].Value }

# Ordre des pages : arbre /Pages depuis la racine (sans /Parent).
$root = $objs.Keys | Where-Object { $objs[$_] -match '/Type /Pages' -and $objs[$_] -notmatch '/Parent' } | Select-Object -First 1
$order = New-Object System.Collections.Generic.List[int]
function Walk([int]$id) {
  $o = $objs[$id]
  if ($o -match '/Type /Pages') {
    $kids = [regex]::Match($o, '/Kids \[([^\]]*)\]').Groups[1].Value
    foreach ($k in [regex]::Matches($kids, '(\d+) 0 R')) { Walk ([int]$k.Groups[1].Value) }
  } else { $order.Add($id) }
}
Walk $root

function Decode([string]$s) {
  if ($s.StartsWith('<')) {
    $hex = $s.Trim('<', '>') -replace '\s', ''
    $bytes = for ($i = 0; $i -lt $hex.Length; $i += 2) { [Convert]::ToByte($hex.Substring($i, 2), 16) }
    if ($bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) { return [System.Text.Encoding]::BigEndianUnicode.GetString([byte[]]$bytes, 2, $bytes.Length - 2) }
    return [System.Text.Encoding]::GetEncoding(28591).GetString([byte[]]$bytes)
  }
  $t = $s.Substring(1, $s.Length - 2)
  $t = [regex]::Replace($t, '\\([0-7]{1,3})', { param($m) [string][char][Convert]::ToInt32($m.Groups[1].Value, 8) })
  $t = $t -replace '\\\(', '(' -replace '\\\)', ')' -replace '\\\\', '\'
  $bytes = [System.Text.Encoding]::GetEncoding(28591).GetBytes($t)
  if ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) { return [System.Text.Encoding]::BigEndianUnicode.GetString($bytes, 2, $bytes.Length - 2) }
  return $t
}

$map = [ordered]@{}
foreach ($o in $objs.Values) {
  $m = [regex]::Match($o, '(?s)/Title (\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]*>).*?/Dest \[(\d+) 0 R')
  if (-not $m.Success) { continue }
  $title = ((Decode $m.Groups[1].Value) -replace '\s+', ' ').Trim()
  $page = $order.IndexOf([int]$m.Groups[2].Value) + 1
  if ($page -gt 0 -and -not $map.Contains($title)) { $map[$title] = $page }
}
$json = ($map.GetEnumerator() | ForEach-Object { '  ' + (ConvertTo-Json $_.Key) + ': ' + $_.Value }) -join ",`n"
[System.IO.File]::WriteAllText($out, "window.PAGES = {`n$json`n};`n", (New-Object System.Text.UTF8Encoding $false))
"$($map.Count) signets, $($order.Count) pages"
