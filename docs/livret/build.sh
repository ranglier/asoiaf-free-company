#!/usr/bin/env bash
# Assemble le livret « ASOIAF Free Company : Règles » (sections de src/, dans l'ordre des noms) et produit le PDF
# avec Edge sans interface, signets compris. Deux passes : la première donne les numéros de page des titres
# (pages.ps1 lit les signets), la seconde les écrit dans le sommaire. Usage : bash docs/livret/build.sh
set -e
cd "$(dirname "$0")"
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
DIR_WIN=$(cygpath -w "$PWD")
PROFILE=$(cygpath -w "${TMP:-/tmp}/livret-edge")
{
  echo '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>ASOIAF Free Company : Règles</title>'
  echo '<link rel="stylesheet" href="livret.css"></head><body>'
  cat src/*.html
  echo '<script src="pages.js"></script><script src="schemas.js"></script><script src="sections.js"></script><script src="sommaire.js"></script></body></html>'
} > livret.html
perl tables.pl livret.html
print() {
  "$EDGE" --headless=new --disable-gpu --no-pdf-header-footer --generate-pdf-document-outline --user-data-dir="$PROFILE" \
    --virtual-time-budget=10000 --print-to-pdf="$DIR_WIN\\asoiaf-free-company-regles.pdf" "file:///${DIR_WIN//\\//}/livret.html" 2>/dev/null
}
echo 'window.PAGES = {};' > pages.js
print
powershell -NoProfile -ExecutionPolicy Bypass -File pages.ps1 "$DIR_WIN\\asoiaf-free-company-regles.pdf" "$DIR_WIN\\pages.js"
print
powershell -NoProfile -ExecutionPolicy Bypass -File signets.ps1 "$DIR_WIN\\asoiaf-free-company-regles.pdf" "$DIR_WIN\\livret.html"
echo "asoiaf-free-company-regles.pdf"
