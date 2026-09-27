# Fabrique l'APK du Guide des Sports, signe et pret a installer.
#
#   powershell -ExecutionPolicy Bypass -File mobile\fabriquer-apk.ps1
#
# Ce que fait ce script, et pourquoi dans cet ordre
# ------------------------------------------------
#   1. `assembler-www.mjs`   rassemble ce que l'APK emporte (voir ce fichier)
#   2. `cap sync android`    recopie www/ dans les ressources du projet Android
#   3. `assembleRelease`     produit un APK NON SIGNE -- Gradle n'a aucune cle
#   4. `zipalign`            aligne les fichiers sur 4 octets ; apksigner refuse
#                            de poser une signature v2 sur un APK non aligne
#   5. `apksigner`           signe avec la cle locale
#
# La cle et son mot de passe restent HORS du depot (D:\sdk\keys) : rien de
# secret n'entre dans l'historique git, et `cap sync` peut reecrire les fichiers
# Gradle sans rien emporter de la signature.
#
# La cle est auto-signee et vaut trente ans. Elle ne sert pas a prouver qui a
# ecrit l'application, mais a permettre les MISES A JOUR : Android n'installe
# par-dessus une application existante que si la nouvelle porte LA MEME
# signature. Perdre la cle veut dire desinstaller avant de reinstaller, donc
# perdre favoris, ligues et reglages.
#
# AVANT DE FABRIQUER : l'APK embarque un instantane du calendrier et des liens.
# Lancez d'abord, dans le depot,
#     node scripts/scrape_schedule.mjs
#     npm run scrape:streams
#     node scripts/verify_players.mjs --total 600 --budget-ms 1500000
# sinon l'application demarrera sur une passe ESPN complete (elle sait le faire,
# voir js/api.js) mais partira avec des liens non verifies.

param(
    [string]$Jdk = 'D:\sdk\jdk21',
    [string]$AndroidSdk = 'D:\sdk\android',
    [string]$BuildTools = '35.0.0',
    [string]$Keystore = 'D:\sdk\keys\apps-locales.keystore',
    [string]$KeyAlias = 'apps-locales',
    [string]$KeyPass = 'apps-locales',
    [string]$Sortie = ''
)

$ErrorActionPreference = 'Stop'
$ICI = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Sortie) { $Sortie = Join-Path $ICI 'Guide-des-Sports.apk' }

$env:JAVA_HOME = $Jdk
$env:ANDROID_HOME = $AndroidSdk
$env:ANDROID_SDK_ROOT = $AndroidSdk
$env:PATH = "$Jdk\bin;" + $env:PATH

$outils = Join-Path $AndroidSdk "build-tools\$BuildTools"
foreach ($n in @("$Jdk\bin\java.exe", "$outils\zipalign.exe", "$outils\apksigner.bat", $Keystore)) {
    if (-not (Test-Path $n)) { throw "introuvable : $n" }
}

Write-Output '--- 1/5  rassemblement des fichiers ---'
Set-Location $ICI

# La liste d'hotes a bloquer, si elle manque ou si elle a plus d'une semaine. Les
# listes d'uBlock changent tous les jours ; un blocage de six mois laisse passer les
# regies apparues depuis. Le telechargement prend une quinzaine de secondes.
$liste = Join-Path $ICI 'blocage-hotes.txt'
$vieille = (Test-Path $liste) -and ((Get-Item $liste).LastWriteTime -lt (Get-Date).AddDays(-7))
if (-not (Test-Path $liste) -or $vieille) {
    Write-Output $(if ($vieille) { '      liste de blocage datee : on la refait' } else { '      liste de blocage absente : on la fabrique' })
    node construire-blocage.mjs 2>&1 | Select-Object -Last 3
}

node assembler-www.mjs

Write-Output '--- 2/5  synchronisation du projet Android ---'
npx cap sync android 2>&1 | Select-Object -Last 4

Write-Output '--- 3/5  compilation ---'
Set-Location (Join-Path $ICI 'android')
# javac ecrit ses notes ("Some input files use unchecked or unsafe operations")
# sur la sortie d'erreur. Avec $ErrorActionPreference a 'Stop', PowerShell en
# fait une exception et la compilation s'arrete alors qu'elle a reussi : on juge
# donc Gradle sur son CODE DE SORTIE, pas sur ce qu'il ecrit.
$avant = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
.\gradlew.bat assembleRelease --no-daemon 2>&1 |
    Select-String -Pattern 'BUILD |FAILURE|error:' | Select-Object -Last 8
$codeGradle = $LASTEXITCODE
$ErrorActionPreference = $avant
if ($codeGradle -ne 0) { throw "Gradle a echoue (code $codeGradle)" }

$brut = Join-Path $ICI 'android\app\build\outputs\apk\release\app-release-unsigned.apk'
if (-not (Test-Path $brut)) { throw "Gradle n'a pas produit d'APK ($brut)" }

Write-Output '--- 4/5  alignement ---'
$aligne = Join-Path $env:TEMP 'footy-aligne.apk'
if (Test-Path $aligne) { Remove-Item $aligne -Force }
& "$outils\zipalign.exe" -p 4 $brut $aligne
if ($LASTEXITCODE -ne 0) { throw 'zipalign a echoue' }

Write-Output '--- 5/5  signature ---'
if (Test-Path $Sortie) { Remove-Item $Sortie -Force }
& "$outils\apksigner.bat" sign --ks $Keystore --ks-pass "pass:$KeyPass" --key-pass "pass:$KeyPass" `
    --ks-key-alias $KeyAlias --out $Sortie $aligne
if ($LASTEXITCODE -ne 0) { throw 'apksigner a echoue' }
Remove-Item $aligne -Force

Write-Output ''
& "$outils\apksigner.bat" verify --print-certs $Sortie 2>&1 | Select-Object -First 3
Write-Output ''
Write-Output ("APK : $Sortie  ({0:N1} Mo)" -f ((Get-Item $Sortie).Length / 1MB))
Write-Output ''
Write-Output "Pour l'installer : copiez le fichier sur le telephone et ouvrez-le."
Write-Output "Par cable : adb install -r `"$Sortie`""
