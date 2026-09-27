# Le pipeline de donnees du Guide des Sports : un RATTRAPAGE a la main.
#
#   powershell -ExecutionPolicy Bypass -File local\pipeline.ps1
#
# CE SCRIPT N EST PLUS LE CHEMIN NORMAL. L application de bureau fait ces trois
# etapes elle-meme, toutes les 30 minutes, TANT QU ELLE EST OUVERTE (voir
# desktop/main.js, passeComplete). Il n y a donc plus de tache planifiee : rien ne
# tourne quand personne ne regarde, et il n y a rien a desinstaller.
#
# Ce script reste pour le cas ou l application n a pas tourne depuis longtemps et
# qu on veut tout rattraper d un coup, avec un budget de verification qu une passe
# de 8 minutes ne peut pas donner :
#
#   powershell -File local\pipeline.ps1 -VerifTotal 600 -VerifBudgetMs 1500000
#
# Ce qu'il remplace, et ce qui manquait
# ------------------------------------
# Trois Actions portaient les donnees :
#
#   scrape_schedule.yml   le calendrier du jour, une fois par jour
#   scrape_streams.yml    les liens de diffusion, toutes les 30 min
#   (2e etape du meme)    verify_players.mjs, qui EPROUVE les liens dans un vrai
#                         Chromium et note lesquels jouent vraiment
#
# La troisieme est celle dont l'absence se voit le plus. Mesure du 26 septembre
# 2026, sur le cache du jour :
#
#     4825 liens, 113 hotes distincts
#     hotes AVEC un verdict :  24  ->  1217 liens
#     hotes SANS verdict    :  89  ->  3608 liens  (74 % des liens)
#     registre datant du 21 septembre, liens datant du 26
#
# Or le navigateur CLASSE les liens d'apres ce registre (playabilityScore,
# js/playability.js). Avec les trois quarts des liens sans verdict, le classement
# n'avait presque rien pour travailler : les hotes morts sortaient au meme rang
# que les bons. Un seul exemple donne l'echelle -- sportplus.watch portait 950
# liens, un cinquieme du total, et n'avait jamais ete eprouve une seule fois.
#
# Pourquoi le registre etait si vide, alors que le script existait depuis des
# semaines : ses bornes par defaut (--total 150, --budget-ms 5 min, 4 essais par
# hote) sont taillees pour un runner GitHub. Et GitHub ne livrait que cinq
# passages par jour. 113 hotes ne pouvaient pas etre couverts.
#
# En local, ces bornes n'ont plus de raison d'etre : c'est le seul changement
# necessaire pour que le classement se mette a fonctionner.
#
# Ordre des etapes, et pourquoi
# -----------------------------
#   1. le calendrier D'ABORD : les liens sont rattaches aux matchs du jour, donc
#      un calendrier de la veille ferait recolter des liens pour des matchs qui
#      ne seront pas affiches. Saute s'il est deja du jour.
#   2. les liens ensuite.
#   3. la verification en dernier : elle a besoin des liens pour savoir quoi
#      eprouver, et elle n'eprouve que les matchs en direct ou imminents.
#
# Aucune etape ne fait echouer les suivantes : un scraper muet laisse le fichier
# precedent intact (c'est ecrit dans les scripts), et mieux vaut des liens d'il y
# a une heure qu'une application vide.

param(
    # Le budget de la verification. 8 minutes par passage entretient le registre ;
    # pour un rattrapage complet (premier usage, ou apres une longue pause) :
    #   -VerifBudgetMs 1500000 -VerifTotal 600
    [int]$VerifBudgetMs = 480000,
    [int]$VerifTotal = 300,
    [switch]$SansVerification,
    [switch]$SansLiens
)

$ICI = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ICI

# Les repertoires systeme d'abord, parce qu'ils manquent au PATH de cette machine.
#
# Releve le 26 septembre 2026 : le PATH machine (HKLM) ne contient ni
# C:\Windows\System32, ni C:\Windows, ni System32\WindowsPowerShell\v1.0 — il a
# visiblement ete ecrase par une copie du PATH utilisateur. Consequences vues
# directement : electron-builder echouait sur « spawn powershell.exe ENOENT », et la
# tache planifiee sur 0x80070002. npm et Playwright lancent eux aussi des outils
# systeme.
#
# On ne repare pas la variable ici — c'est une modification machine, qui demande les
# droits d'administrateur et ne regarde pas ce script. On se contente de ne pas en
# dependre.
foreach ($d in @("$env:SystemRoot\System32", $env:SystemRoot, "$env:SystemRoot\System32\WindowsPowerShell\v1.0", "$env:SystemRoot\System32\Wbem")) {
    if ((Test-Path $d) -and ($env:PATH -split ';' -notcontains $d)) { $env:PATH = "$d;" + $env:PATH }
}

function Etape($n, $titre) { Write-Output "" ; Write-Output "===== $n  $titre  ($(Get-Date -Format HH:mm:ss)) =====" }

# javac et les scrapers ecrivent sur la sortie d'erreur sans que ce soit une
# panne : on juge chaque etape sur son code de sortie.
$ErrorActionPreference = 'Continue'

# ---- 1. Le calendrier ----------------------------------------------------
$jour = (Get-Date).ToUniversalTime().AddHours(-4).ToString('yyyyMMdd')  # approximation, affinee ci-dessous
try {
    $tz = [System.TimeZoneInfo]::FindSystemTimeZoneById('Eastern Standard Time')
    $jour = [System.TimeZoneInfo]::ConvertTime([DateTime]::UtcNow, [System.TimeZoneInfo]::Utc, $tz).ToString('yyyyMMdd')
} catch { }

$dejaDuJour = $false
if (Test-Path 'data\schedule.json') {
    try { $dejaDuJour = ((Get-Content 'data\schedule.json' -Raw | ConvertFrom-Json).fetchDate -eq $jour) } catch { }
}

if ($dejaDuJour) {
    Etape '1/3' "calendrier deja du $jour, rien a faire"
} else {
    Etape '1/3' "calendrier ($jour)"
    node scripts/scrape_schedule.mjs 2>&1 | Select-Object -Last 6
    if ($LASTEXITCODE -ne 0) { Write-Output "  (le calendrier n'a pas pu etre refait ; on continue avec le precedent)" }
}

# ---- 2. Les liens --------------------------------------------------------
if ($SansLiens) {
    Etape '2/3' 'liens : saute (-SansLiens)'
} else {
    Etape '2/3' 'liens de diffusion'
    # L'alias npm passe --max-old-space-size=8192 : le scraper en a besoin.
    npm run scrape:streams 2>&1 | Select-String -Pattern 'data/streams.json|Requetes|Requêtes|Pages de match|Integration|Verifications|Vérifications|Passe partielle|domains.json' | Select-Object -Last 10
    if ($LASTEXITCODE -ne 0) { Write-Output '  (la lecture des sources a echoue ; les liens precedents sont conserves)' }
}

# ---- 3. La verification --------------------------------------------------
if ($SansVerification) {
    Etape '3/3' 'verification : sautee (-SansVerification)'
} else {
    Etape '3/3' "verification des lecteurs (budget $([int]($VerifBudgetMs/1000)) s, $VerifTotal cibles)"
    node scripts/verify_players.mjs --total $VerifTotal --budget-ms $VerifBudgetMs 2>&1 | Select-Object -Last 10
    if ($LASTEXITCODE -ne 0) { Write-Output '  (la verification a echoue ; le registre precedent est conserve)' }
}

# ---- Bilan ---------------------------------------------------------------
Write-Output ''
Write-Output '===== bilan ====='
node -e @'
const fs = require('fs');
const t = JSON.parse(fs.readFileSync('data/streams.json', 'utf8'));
const hp = t.hostPlay || {};
const hotes = new Map();
let liens = 0;
for (const m of t.matches || []) for (const l of m.streamLinks || []) {
  let h; try { h = new URL(l.url).hostname; } catch { h = '?'; }
  hotes.set(h, (hotes.get(h) || 0) + 1); liens++;
}
const avec = [...hotes.keys()].filter((h) => hp[h]);
const sans = [...hotes.keys()].filter((h) => !hp[h]);
const cpt = (l) => l.reduce((n, h) => n + hotes.get(h), 0);
const juge = (f) => [...hotes.keys()].filter((h) => hp[h] && hp[h].tested >= 3 && f(hp[h]));
const morts = juge((e) => e.plays === 0);
const bons = juge((e) => e.plays / e.tested >= 0.5);
console.log(`liens : ${liens}  |  hotes : ${hotes.size}`);
console.log(`registre : ${Object.keys(hp).length} hotes, verifie le ${t.verifiedAt || 'jamais'}`);
console.log(`avec verdict : ${avec.length} hotes -> ${cpt(avec)} liens (${Math.round(100 * cpt(avec) / liens)}%)`);
console.log(`sans verdict : ${sans.length} hotes -> ${cpt(sans)} liens (${Math.round(100 * cpt(sans) / liens)}%)`);
console.log(`juges BONS   : ${bons.length} hotes -> ${cpt(bons)} liens`);
console.log(`juges MORTS  : ${morts.length} hotes -> ${cpt(morts)} liens`);
if (sans.length) {
  const pire = sans.sort((a, b) => hotes.get(b) - hotes.get(a)).slice(0, 5);
  console.log('les plus gros hotes encore sans verdict : ' + pire.map((h) => `${h} (${hotes.get(h)})`).join(', '));
}
'@
