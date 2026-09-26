# Enregistre le pipeline dans le Planificateur de taches de Windows.
#
#   powershell -ExecutionPolicy Bypass -File local\installer-la-tache.ps1
#   powershell -ExecutionPolicy Bypass -File local\installer-la-tache.ps1 -Retirer
#
# Pourquoi 30 minutes, et pourquoi c'est mieux qu'avant
# ----------------------------------------------------
# scrape_streams.yml demandait deux passages par heure et ajoutait un relais qui
# se relancait lui-meme, parce que GitHub n'honorait le cron que cinq a six fois
# par jour -- releve dans le workflow : 00:15, 04:48, 09:46, 13:57, 17:50, 20:56,
# soit un passage toutes les 3 a 5 heures. Le relais existait pour compenser un
# planificateur qui ne part pas a l'heure.
#
# Le Planificateur de Windows, lui, part a l'heure. Une tache toutes les 30
# minutes donne 48 passages par jour la ou GitHub en livrait 5 ou 6, et le relais
# n'a plus aucune raison d'etre.
#
# La tache ne tourne que si l'ordinateur est allume et ne le reveille pas : ces
# donnees ne valent que pour aujourd'hui, donc rattraper une nuit d'absence n'a
# aucun interet. Au retour, le premier passage refait tout.

param([switch]$Retirer)

$ErrorActionPreference = 'Stop'
$NOM = 'Guide des Sports - donnees'
$DEPOT = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PIPELINE = Join-Path $DEPOT 'local\pipeline.ps1'

if ($Retirer) {
    if (Get-ScheduledTask -TaskName $NOM -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $NOM -Confirm:$false
        Write-Output "tache retiree : $NOM"
    } else {
        Write-Output "aucune tache nommee : $NOM"
    }
    return
}

if (-not (Test-Path $PIPELINE)) { throw "pipeline introuvable : $PIPELINE" }

$action = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PIPELINE`"" `
    -WorkingDirectory $DEPOT

# Le premier depart dans deux minutes, puis toutes les 30 min, sans fin.
$declencheur = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(2)) `
    -RepetitionInterval (New-TimeSpan -Minutes 30)

$reglages = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 28)

# `IgnoreNew` : un passage dure jusqu'a 20 minutes (lecture des sources puis
# verification). Sans cela, deux passages se chevaucheraient et se disputeraient
# data/streams.json -- exactement la course que les commentaires du workflow
# decrivent, et qui avait fait perdre un cache entier le 6 septembre 2026.
# `ExecutionTimeLimit` a 28 min : un passage bloque est tue avant le suivant.

Register-ScheduledTask -TaskName $NOM -Action $action -Trigger $declencheur `
    -Settings $reglages -Description 'Calendrier, liens de diffusion et verification des lecteurs du Guide des Sports.' `
    -Force | Out-Null

Write-Output "tache enregistree : $NOM"
Write-Output "  toutes les 30 minutes, premier depart dans 2 minutes"
Write-Output "  pipeline : $PIPELINE"
Write-Output ''
Write-Output 'Pour la voir tourner :   Get-ScheduledTaskInfo -TaskName "' + $NOM + '"'
Write-Output 'Pour la lancer tout de suite :   Start-ScheduledTask -TaskName "' + $NOM + '"'
Write-Output 'Pour la retirer :   powershell -File local\installer-la-tache.ps1 -Retirer'
