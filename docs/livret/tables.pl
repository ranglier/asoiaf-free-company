# Numérote les tables du livret par chapitre (« Table 2-6 : Terrains ») et remplit l'index des tables.
# Chaque <caption>Titre</caption> devient <caption id="t2-6"><h5>Table 2-6 : Titre</h5></caption> : le titre en h5
# entre dans les signets du PDF, ce qui donne sa page à l'index (pages.ps1, sommaire.js).
# L'index se place à l'endroit du commentaire <!-- index-tables -->. Usage : perl tables.pl livret.html
use strict; use warnings;
my $file = shift or die "usage : perl tables.pl livret.html\n";
open my $in, '<', $file or die "$file : $!"; local $/; my $s = <$in>; close $in;

my ($chap, $n, @index) = (0, 0);
my %noms;
$s =~ s{(id="ch(\d+)"[^>]*>\s*<p class="surtitre">[^<]*</p>\s*<h1>([^<]*)</h1>)|<caption>([^<]*)</caption>}{
  if (defined $1) { ($chap, $n) = ($2, 0); $noms{$chap} = $3; push @index, [$chap]; $1 }
  else { $n++; my $id = "t$chap-$n"; push @index, [$chap, $id, "Table $chap-$n", $4]; qq{<caption id="$id"><h5>Table $chap-$n&nbsp;: $4</h5></caption>} }
}ge;

my $li = join "\n", map {
  @$_ == 1
    ? qq{  <li class="chap"><span>$_->[0]</span><span>$noms{$_->[0]}</span></li>}
    : qq{  <li><a href="#$_->[1]"><span>$_->[2]</span><span>$_->[3]</span><span class="p" data-for="$_->[1]"></span></a></li>}
} @index;
$s =~ s{<!-- index-tables -->}{$li} or die "pas de <!-- index-tables --> dans $file\n";

open my $out, '>', $file or die; print $out $s; close $out;
printf "%d tables\n", scalar grep { @$_ > 1 } @index;
