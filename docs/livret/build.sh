#!/usr/bin/env bash
# Assemble le livret « ASOIAF Free Company : Règles » (sections de src/, dans l'ordre des noms) et produit le PDF
# avec Edge sans interface, signets compris. Deux passes : la première donne les numéros de page des titres
# (pages.ps1 lit les signets), la seconde les écrit dans le sommaire.
# Usage : bash docs/livret/build.sh [édition]
#   global (par défaut) : le livret entier ;
#   compagnie, batailles : un chapitre seul, avec couverture, sommaire et index de ses tables (sans 2.10 Mener une
#     bataille, réservée au livret entier) ;
#   aide-compagnie, aide-batailles, fiche-troupe : les aides de jeu, sans couverture (dossier aides/) ;
#   tout : toutes les éditions.
# Les éditions partielles reprennent les mêmes fichiers de src/ : aucun texte n'est dupliqué.
set -e
cd "$(dirname "$0")"
ED="${1:-global}"
if [ "$ED" = tout ]; then
  for e in global compagnie batailles aide-compagnie aide-batailles fiche-troupe; do bash "$0" "$e"; done
  exit
fi
case "$ED" in
  global)         FILES=(src/*.html); OUT=asoiaf-free-company-regles; LABEL="" ;;
  compagnie)      FILES=(src/00-*.html src/1*.html src/2c-*.html); OUT=asoiaf-free-company-regles-1-compagnie; LABEL="Chapitre 1 : La Compagnie" ;;
  batailles)      FILES=(src/00-*.html src/2[1-9b]-*.html src/2c-*.html); OUT=asoiaf-free-company-regles-2-batailles; LABEL="Chapitre 2 : Batailles" ;;
  aide-compagnie) FILES=(src/19-annexe.html); OUT=aides/aide-de-jeu-compagnie; LABEL="" ;;
  aide-batailles) FILES=(src/2b-memo.html); OUT=aides/aide-de-jeu-batailles; LABEL="" ;;
  fiche-troupe)   FILES=(src/2b-fiche.html); OUT=aides/fiche-de-troupe; LABEL="" ;;
  *) echo "édition inconnue : $ED" >&2; exit 1 ;;
esac
mkdir -p aides
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
DIR_WIN=$(cygpath -w "$PWD")
PROFILE=$(cygpath -w "${TMP:-/tmp}/livret-edge")
# Fichiers de travail : livret.html et pages.js pour le livret entier, suffixés pour les autres éditions.
SUFFIX=""; [ "$ED" != global ] && SUFFIX="-$ED"
HTML="livret$SUFFIX.html" PAGES="pages$SUFFIX.js" PDF_WIN="$DIR_WIN\\${OUT//\//\\}.pdf"
HEADER=""; case "$ED" in aide-*|fiche-troupe) HEADER="ASOIAF Free Company : aide de jeu" ;; esac
{
  echo '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>ASOIAF Free Company : Règles</title>'
  echo '<link rel="stylesheet" href="livret.css">'
  [ -n "$HEADER" ] && echo "<style>@page { @top-right { content: \"$HEADER\"; } }</style>"
  echo "</head><body data-edition=\"$ED\" data-label=\"$LABEL\">"
  cat "${FILES[@]}"
  echo "<script src=\"$PAGES\"></script><script src=\"schemas.js\"></script><script src=\"edition.js\"></script><script src=\"sections.js\"></script><script src=\"sommaire.js\"></script></body></html>"
} > "$HTML"
# L'index des tables n'existe que dans le livret et les chapitres.
if grep -q '<!-- index-tables -->' "$HTML"; then perl tables.pl "$HTML"; fi
print() {
  "$EDGE" --headless=new --disable-gpu --no-pdf-header-footer --generate-pdf-document-outline --user-data-dir="$PROFILE" \
    --virtual-time-budget=10000 --print-to-pdf="$PDF_WIN" "file:///${DIR_WIN//\\//}/$HTML" 2>/dev/null
}
echo 'window.PAGES = {};' > "$PAGES"
print
powershell -NoProfile -ExecutionPolicy Bypass -File pages.ps1 "$PDF_WIN" "$DIR_WIN\\$PAGES"
print
powershell -NoProfile -ExecutionPolicy Bypass -File signets.ps1 "$PDF_WIN" "$DIR_WIN\\$HTML"
echo "$OUT.pdf"
