# Répare les signets qu'Edge double quand un titre est repoussé en haut de page (« 1.71.7 Le combat Le combat »).
# Chaque signet abîmé est remplacé par le vrai titre (les <h1> de livret.html), complété d'espaces pour garder la
# même longueur d'octets : les positions du PDF ne bougent pas. Usage : powershell -File signets.ps1 livret.pdf livret.html
param([string]$pdf, [string]$html)
$latin = [System.Text.Encoding]::GetEncoding(28591)
$bytes = [System.IO.File]::ReadAllBytes($pdf)
$raw = $latin.GetString($bytes)
$src = [System.IO.File]::ReadAllText($html, [System.Text.Encoding]::UTF8)
$titles = foreach ($m in [regex]::Matches($src, '(?s)<h[15][^>]*>(.*?)</h[15]>')) {
  (($m.Groups[1].Value -replace '<[^>]+>', '' -replace '&nbsp;', ' ' -replace '&amp;', '&') -replace '\s+', ' ').Trim()
}
$norm = { param($s) ($s -replace '\s+', '').ToLowerInvariant() }
$fixed = 0
foreach ($m in [regex]::Matches($raw, '/Title (<FEFF[0-9A-Fa-f]*>|\((?:\\.|[^\\)])*\))')) {
  $token = $m.Groups[1].Value
  if ($token.StartsWith('<')) {
    $hex = $token.Substring(5, $token.Length - 6)
    $chars = for ($i = 0; $i -lt $hex.Length; $i += 4) { [char][Convert]::ToInt32($hex.Substring($i, 4), 16) }
    $text = -join $chars
  } else { $text = $token.Substring(1, $token.Length - 2) -replace '\\(.)', '$1' }
  if ($titles -contains $text.Trim()) { continue }
  $good = $titles | Where-Object { (& $norm $text).Contains((& $norm $_)) -and $_.Length -lt $text.Length } | Sort-Object Length -Descending | Select-Object -First 1
  if (-not $good) { continue }
  if ($token.StartsWith('<')) {
    $n = ($token.Length - 6) / 4
    $new = '<FEFF' + (-join ($good.PadRight($n).ToCharArray() | ForEach-Object { '{0:X4}' -f [int]$_ })) + '>'
  } else {
    if ($good -match '[()\\]' -or $good -match '[^\x20-\x7E]') { continue }
    $new = '(' + $good.PadRight($token.Length - 2) + ')'
  }
  if ($new.Length -ne $token.Length) { continue }
  $at = $m.Groups[1].Index
  $latin.GetBytes($new).CopyTo($bytes, $at)
  $fixed++
}
[System.IO.File]::WriteAllBytes($pdf, $bytes)
"$fixed signet(s) corrige(s)"
