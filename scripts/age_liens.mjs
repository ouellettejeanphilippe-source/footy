/*
  Âge du cache des liens (data/streams.json), pour la veille du workflow du calendrier
  (.github/workflows/scrape_schedule.yml, job `veille`).

  « Je veux pas faire rien d'externe » (28 octobre 2026) : pas de service de surveillance
  hors de GitHub. La chaîne des 30 minutes s'est déjà arrêtée sans prévenir (cron mort du
  20 septembre au 9 octobre 2026, relance en HTTP 500 le 6 octobre), et on l'a appris par
  le bandeau « Liens datant de 9 h » un jour de match. Ce script dit seulement l'âge du
  cache ; le workflow ouvre ou ferme une issue du dépôt d'après sa réponse, et GitHub
  envoie son courriel habituel.

  Usage : node scripts/age_liens.mjs [fichier] [--seuil-min N] [--maintenant ISO]
  Sortie : une ligne JSON { generatedAt, ageMin, seuilMin, perime, raison? }.
  Ne fait jamais échouer le passage : un fichier absent ou illisible est « périmé » avec
  sa raison, parce que c'est bien un cache qu'on ne peut pas servir.
*/
import fs from 'fs';

export const SEUIL_MIN_DEFAUT = 180;   // six créneaux manqués d'affilée : ce n'est plus un retard

export function ageDuCache(texte, maintenant, seuilMin) {
    const seuil = seuilMin > 0 ? seuilMin : SEUIL_MIN_DEFAUT;
    let data;
    try { data = JSON.parse(texte); }
    catch (e) { return { generatedAt: null, ageMin: null, seuilMin: seuil, perime: true, raison: 'fichier illisible' }; }
    const t = Date.parse(data && data.generatedAt);
    if (!Number.isFinite(t)) return { generatedAt: null, ageMin: null, seuilMin: seuil, perime: true, raison: 'generatedAt absent' };
    const ageMin = Math.max(0, Math.round((maintenant - t) / 60000));
    return { generatedAt: data.generatedAt, ageMin, seuilMin: seuil, perime: ageMin > seuil };
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);
    const opt = (nom) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : undefined; };
    const fichier = args.find((a) => !a.startsWith('--') && a !== opt('--seuil-min') && a !== opt('--maintenant')) || 'data/streams.json';
    const maintenant = opt('--maintenant') ? Date.parse(opt('--maintenant')) : Date.now();
    let texte = '';
    try { texte = fs.readFileSync(fichier, 'utf8'); } catch (e) { texte = ''; }
    const r = ageDuCache(texte, maintenant, Number(opt('--seuil-min')));
    if (!texte) r.raison = 'fichier absent';
    console.log(JSON.stringify(r));
}
