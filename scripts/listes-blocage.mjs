/* La lecture des listes d'uBlock, partagée par les deux bloqueurs qui n'ont pas le
 * moteur complet : la liste d'hôtes de l'APK (mobile/construire-blocage.mjs) et les
 * règles de l'extension Chrome (extension/construire.mjs).
 *
 * On ne garde que ce qui s'exprime en un seul nom d'hôte, valable sur toute page :
 *
 *   ||exemple.com^                gardé   blocage de domaine, sans condition
 *   ||exemple.com^$third-party    gardé   un domaine tiers dédié à la publicité
 *   ||exemple.com^$script         ÉCARTÉ  ne vise qu'un type ; bloquer TOUT l'hôte
 *                                         sur cette base sur-bloquerait un CDN
 *   ||exemple.com^$domain=a.com   ÉCARTÉ  dépend de la page, qu'on ne sait pas juger
 *   @@||exemple.com^              exception : l'hôte est retiré de la liste
 *   exemple.com##.pub             ÉCARTÉ  cosmétique
 *
 * La prudence est volontaire. Une publicité qui passe est un désagrément ; un flux
 * vidéo bloqué par erreur est une application cassée.
 *
 * Aucun import : le module se lit sous Node comme dans un test. */

/* Les options qui laissent la règle valoir pour tout l'hôte. Le reste — un type de
   ressource, un `domain=`, une négation — nous échappe, donc on n'y touche pas. */
const OPTIONS_SUES = new Set(['third-party', '3p', 'all', 'popup', 'doc', 'document']);

const REGLE = /^\|\|([a-z0-9][a-z0-9._-]*\.[a-z]{2,})\^(\$(.*))?$/i;

/* Les domaines dont l'application NE PEUT PAS se passer, quoi qu'en disent les listes.
   Aucun n'y figure aujourd'hui — cette barrière existe pour le jour où l'une d'elles
   ajoutera un CDN vidéo ou l'API des scores, et où l'application deviendrait muette
   sans qu'on comprenne pourquoi. */
export const JAMAIS = ['espn.com', 'site.api.espn.com', 'cdn.espn.com', 'jsdelivr.net', 'cdnjs.cloudflare.com'];

export function hoteDeLaRegle(ligne) {
  const m = REGLE.exec(ligne);
  if (!m) return null;
  const options = (m[3] || '').trim();
  if (options) {
    const parts = options.split(',').map((o) => o.trim().toLowerCase());
    if (!parts.every((o) => OPTIONS_SUES.has(o))) return null;
  }
  return m[1].toLowerCase();
}

/* Lit le texte d'une liste dans les deux ensembles. Rend le nombre d'hôtes retenus. */
export function lireListe(texte, bloques, exceptions) {
  let n = 0;
  for (const brute of texte.split('\n')) {
    const ligne = brute.trim();
    if (!ligne || ligne[0] === '!' || ligne[0] === '[') continue;
    if (ligne.includes('##') || ligne.includes('#@#') || ligne.includes('#?#') || ligne.includes('#$#')) continue;

    if (ligne.startsWith('@@')) {
      const h = hoteDeLaRegle(ligne.slice(2));
      if (h) exceptions.add(h);
      continue;
    }
    const h = hoteDeLaRegle(ligne);
    if (h) { bloques.add(h); n++; }
  }
  return n;
}

/* Télécharge les listes et rend { bloques (trié), exceptions, sauves, lus }.
   Une exception l'emporte toujours : ces listes en posent pour les domaines qu'un
   blocage trop large casserait, et c'est exactement ce qu'on veut éviter. */
export async function construireListe(urls, journal = console.log) {
  let lus = 0;
  const bloques = new Set();
  const exceptions = new Set();
  for (const url of urls) {
    let texte;
    try {
      const r = await fetch(url);
      if (!r.ok) { console.error(`  ${r.status}  ${url}`); continue; }
      texte = await r.text();
    } catch (e) {
      console.error(`  injoignable  ${url} (${e.message})`);
      continue;
    }
    lus += texte.split('\n').length;
    const n = lireListe(texte, bloques, exceptions);
    journal(`  ${String(n).padStart(6)} hôtes  ${url.split('/').slice(-2).join('/')}`);
  }
  for (const h of exceptions) bloques.delete(h);
  const sauves = JAMAIS.filter((h) => bloques.delete(h));
  return { bloques: [...bloques].sort(), exceptions: [...exceptions].sort(), sauves, lus };
}
