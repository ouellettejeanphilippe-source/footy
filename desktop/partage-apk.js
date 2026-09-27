/* Mettre l'APK sur le téléphone, sans câble et sans compte.
 *
 * Le problème
 * -----------
 * L'application sert le site sur 127.0.0.1 — volontairement : ce port fixe porte
 * l'origine sous laquelle les favoris et les réglages sont rangés, et une adresse de
 * boucle locale n'est joignable que depuis cette machine. Un téléphone ne peut donc
 * pas la voir, et il n'y a aucune raison de l'ouvrir sur le réseau pour autant :
 * l'application y lit des pages de sites de flux, ce n'est pas une chose à exposer.
 *
 * Ce module ouvre donc un SECOND serveur, séparé et minuscule, qui ne sert que deux
 * choses — une page et un fichier — et seulement pendant qu'on le demande. Fermer la
 * fenêtre de partage le referme.
 *
 * Ce qu'il sert, et rien d'autre
 * -----------------------------
 *   GET /                 la page de téléchargement
 *   GET /<nom>.apk        l'APK
 *
 * Toute autre adresse reçoit 404. Il n'y a pas de dossier derrière : le chemin de
 * l'APK est fixé au démarrage, jamais construit depuis l'URL, donc rien à remonter.
 */

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const PORT = 47822;

/* L'adresse de cette machine sur le réseau local.
   Le nom d'hôte ne suffit pas : il résout souvent vers 127.0.0.1, qui ne veut rien
   dire pour un téléphone. On prend la première interface IPv4 non interne. */
function adresseReseau() {
  const interfaces = os.networkInterfaces();
  const candidats = [];
  for (const nom of Object.keys(interfaces)) {
    for (const i of interfaces[nom] || []) {
      if (i.family === 'IPv4' && !i.internal) candidats.push({ nom, adresse: i.address });
    }
  }
  if (!candidats.length) return null;
  /* Les adresses privées d'abord : une machine peut porter des interfaces virtuelles
     (Docker, WSL, VPN) dont l'adresse ne mène à aucun téléphone. */
  const prive = candidats.find((c) => /^192\.168\./.test(c.adresse))
    || candidats.find((c) => /^10\./.test(c.adresse))
    || candidats.find((c) => /^172\.(1[6-9]|2\d|3[01])\./.test(c.adresse));
  return (prive || candidats[0]).adresse;
}

function page(url, nomFichier, mo, quand) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Guide des Sports — installer sur le téléphone</title>
<style>
 :root { color-scheme: dark; }
 body { margin:0; min-height:100vh; display:grid; place-items:center;
        background:#0b0f14; color:#e8edf2;
        font:16px/1.6 system-ui,-apple-system,Segoe UI,sans-serif; padding:24px; }
 main { max-width:26rem; text-align:center; }
 h1 { font-size:1.3rem; margin:0 0 .2rem; }
 p { color:#9aa7b4; margin:.4rem 0 1.4rem; }
 a.btn { display:block; padding:1.1rem; border-radius:14px; text-decoration:none;
         background:#2f7d4f; color:#fff; font-weight:700; font-size:1.05rem; }
 a.btn:active { background:#276843; }
 small { display:block; color:#75828f; margin-top:1.4rem; font-size:.85rem; }
 code { color:#c8d3de; }
</style></head><body><main>
<h1>Guide des Sports</h1>
<p>${nomFichier} &middot; ${mo} Mo &middot; ${quand}</p>
<a class="btn" href="${url}" download>Télécharger et installer</a>
<small>Android demandera d'autoriser l'installation depuis cette source :
c'est normal pour une application qui ne vient pas du Play Store.
Si une version est déjà installée, celle-ci se pose par-dessus et garde
vos favoris et vos réglages.</small>
</main></body></html>`;
}

/* Ouvre le partage. Rend { url, arreter() } — ou lève si l'APK n'est pas là. */
async function ouvrirLePartage(cheminApk) {
  const info = await fsp.stat(cheminApk);   // lève si absent : l'appelant le dira
  const nomFichier = path.basename(cheminApk);
  const adresse = adresseReseau();
  if (!adresse) throw new Error('aucune adresse réseau : cette machine n\'est sur aucun réseau local');

  const base = `http://${adresse}:${PORT}`;
  const urlApk = `${base}/${encodeURIComponent(nomFichier)}`;
  const quand = info.mtime.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long' });
  const mo = (info.size / 1048576).toFixed(1);
  const html = Buffer.from(page(urlApk, nomFichier, mo, quand), 'utf8');

  const serveur = http.createServer((req, res) => {
    let chemin;
    try { chemin = decodeURIComponent(new URL(req.url, base).pathname); } catch { chemin = ''; }

    if (chemin === '/' || chemin === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': html.length });
      res.end(html);
      return;
    }
    /* Le nom demandé est comparé au nom ATTENDU, et le fichier servi est celui dont le
       chemin a été fixé au démarrage. Aucun chemin n'est construit depuis l'URL. */
    if (chemin === '/' + nomFichier) {
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': info.size,
        'Content-Disposition': `attachment; filename="${nomFichier}"`,
      });
      fs.createReadStream(cheminApk).pipe(res);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Rien ici. Cette page ne sert que l\'application.');
  });

  await new Promise((resolve, reject) => {
    serveur.once('error', reject);
    // 0.0.0.0 : c'est tout l'objet de ce serveur-ci, et la raison pour laquelle il
    // n'est ouvert qu'à la demande et refermé tout de suite après.
    serveur.listen(PORT, '0.0.0.0', resolve);
  });

  return {
    url: base,
    urlApk,
    nomFichier,
    mo,
    arreter: () => new Promise((r) => serveur.close(() => r())),
  };
}

module.exports = { ouvrirLePartage, adresseReseau, PORT };
