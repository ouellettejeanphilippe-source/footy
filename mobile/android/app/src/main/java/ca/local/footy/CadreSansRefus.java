package ca.local.footy;

import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Les pages qui refusent l'iframe, dans l'APK.
 *
 * <p>« Je veux l'APK avec les mêmes fonctions que le site » (25 octobre 2026). Sur
 * ordinateur, l'extension Chrome (extension/fond.js) et « Ignore X-Frame-Options Header »
 * sur Firefox retirent {@code X-Frame-Options} et {@code frame-ancestors} des pages
 * encadrées par l'application : la tuile s'affiche. La WebView d'Android n'a aucun moyen
 * de toucher aux en-têtes d'une réponse ; son seul point d'accroche est
 * {@code shouldInterceptRequest}, qui peut RENDRE une réponse à la place du réseau. Pour
 * la page d'un cadre, on la télécharge donc nous-mêmes, avec les cookies de la WebView,
 * et on la rend sans ces deux refus. Le reste de la politique de sécurité de la page
 * (ses autres directives CSP) est gardé : seul {@code frame-ancestors} part.
 *
 * <p>Bornes, choisies pour ne rien casser :
 * <ul>
 * <li>seulement la page d'un cadre (GET, pas la fenêtre principale, une page HTML
 * demandée) : ni les scripts, ni les images, ni les flux ;</li>
 * <li>une redirection n'est pas suivie : la réponse se ferait passer pour l'adresse de
 * départ et ses liens relatifs partiraient au mauvais endroit. On rend {@code null}, et
 * la WebView charge elle-même, comme avant ;</li>
 * <li>une erreur réseau rend {@code null} aussi : la WebView réessaie et affiche sa propre
 * erreur, comme avant.</li>
 * </ul>
 *
 * <p>Sans Android : la réponse est rendue dans une forme neutre que
 * {@link BloqueurWebViewClient} change en {@code WebResourceResponse}, et les cookies
 * passent par {@link Cookies}. La règle se teste sur la JVM.
 */
final class CadreSansRefus {

    /** Les cookies de la WebView (CookieManager), vus d'ici. */
    interface Cookies {
        String lire(String url);
        void ecrire(String url, String setCookie);
    }

    /** Une réponse prête pour {@code WebResourceResponse}. */
    static final class Reponse {
        final int statut;
        final String raison;
        final String mime;
        final String encodage;
        final Map<String, String> entetes;
        final InputStream corps;

        Reponse(int statut, String raison, String mime, String encodage, Map<String, String> entetes, InputStream corps) {
            this.statut = statut;
            this.raison = raison;
            this.mime = mime;
            this.encodage = encodage;
            this.entetes = entetes;
            this.corps = corps;
        }
    }

    static final int DELAI_MS = 15000;

    /**
     * Les en-têtes de la WebView qu'on ne recopie pas : l'encodage (le client HTTP
     * d'Android décompresse lui-même ce qu'il a demandé ; recopié, il rendrait des
     * octets compressés sans le dire), les validations de cache (un 304 n'a pas de corps
     * à rendre), et ce que le client pose seul.
     */
    private static final String[] NON_RECOPIES = {
        "accept-encoding", "if-none-match", "if-modified-since", "cookie", "host", "connection", "content-length"
    };

    /** Les en-têtes de réponse qu'on ne rend pas à la WebView. */
    private static final String[] NON_RENDUS = {
        "x-frame-options", "content-encoding", "content-length", "transfer-encoding", "connection", "set-cookie", "keep-alive"
    };

    private CadreSansRefus() {}

    /** La page d'un cadre : GET, pas la fenêtre principale, http(s), une page HTML demandée. */
    static boolean estPageDeCadre(String methode, boolean fenetrePrincipale, Map<String, String> entetes, String url) {
        if (fenetrePrincipale || url == null || !"GET".equalsIgnoreCase(methode)) return false;
        String u = url.toLowerCase(Locale.ROOT);
        if (!u.startsWith("http://") && !u.startsWith("https://")) return false;
        String accept = valeur(entetes, "accept");
        return accept != null && accept.toLowerCase(Locale.ROOT).contains("text/html");
    }

    /** La CSP sans sa directive {@code frame-ancestors} ; {@code null} s'il ne reste rien. */
    static String sansFrameAncestors(String csp) {
        if (csp == null) return null;
        StringBuilder reste = new StringBuilder();
        for (String d : csp.split(";")) {
            String t = d.trim();
            if (t.isEmpty() || t.toLowerCase(Locale.ROOT).startsWith("frame-ancestors")) continue;
            if (reste.length() > 0) reste.append("; ");
            reste.append(t);
        }
        return reste.length() == 0 ? null : reste.toString();
    }

    /** Les en-têtes de réponse rendus : sans les refus d'encadrement ni ce que la WebView gère seule. */
    static Map<String, String> entetesRendus(Map<String, List<String>> brut) {
        Map<String, String> sortie = new LinkedHashMap<>();
        if (brut == null) return sortie;
        for (Map.Entry<String, List<String>> e : brut.entrySet()) {
            if (e.getKey() == null || e.getValue() == null || e.getValue().isEmpty()) continue;
            String nom = e.getKey().toLowerCase(Locale.ROOT);
            if (dans(NON_RENDUS, nom)) continue;
            String v = String.join(", ", e.getValue());
            if (nom.equals("content-security-policy")) {
                v = sansFrameAncestors(v);
                if (v == null) continue;
            }
            sortie.put(e.getKey(), v);
        }
        return sortie;
    }

    /** "text/html; charset=UTF-8" → { "text/html", "UTF-8" } ; sans charset, "utf-8". */
    static String[] typeEtEncodage(String contentType) {
        if (contentType == null || contentType.trim().isEmpty()) return new String[] { "text/html", "utf-8" };
        String[] parts = contentType.split(";");
        String mime = parts[0].trim().toLowerCase(Locale.ROOT);
        String enc = "utf-8";
        for (int i = 1; i < parts.length; i++) {
            String p = parts[i].trim();
            if (p.toLowerCase(Locale.ROOT).startsWith("charset=")) enc = p.substring(8).trim().replace("\"", "");
        }
        return new String[] { mime.isEmpty() ? "text/html" : mime, enc };
    }

    /**
     * Télécharge la page du cadre et la rend sans ses refus d'encadrement. {@code null}
     * quand il vaut mieux laisser la WebView faire (redirection, erreur réseau).
     */
    static Reponse charger(String url, Map<String, String> entetesRequete, Cookies cookies, int delaiMs) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(delaiMs);
            c.setReadTimeout(delaiMs);
            c.setRequestMethod("GET");
            if (entetesRequete != null) {
                for (Map.Entry<String, String> e : entetesRequete.entrySet()) {
                    if (e.getKey() == null || e.getValue() == null) continue;
                    if (dans(NON_RECOPIES, e.getKey().toLowerCase(Locale.ROOT))) continue;
                    c.setRequestProperty(e.getKey(), e.getValue());
                }
            }
            String cookie = cookies != null ? cookies.lire(url) : null;
            if (cookie != null && !cookie.isEmpty()) c.setRequestProperty("Cookie", cookie);

            int statut = c.getResponseCode();
            if (statut >= 300 && statut < 400) { c.disconnect(); return null; }
            if (statut < 100 || statut > 599) { c.disconnect(); return null; }

            Map<String, List<String>> brut = c.getHeaderFields();
            if (cookies != null && brut != null) {
                for (Map.Entry<String, List<String>> e : brut.entrySet()) {
                    if (e.getKey() == null || !e.getKey().equalsIgnoreCase("set-cookie")) continue;
                    for (String v : e.getValue()) cookies.ecrire(url, v);
                }
            }
            String[] te = typeEtEncodage(c.getContentType());
            InputStream corps = statut >= 400 ? c.getErrorStream() : c.getInputStream();
            if (corps == null) corps = new java.io.ByteArrayInputStream(new byte[0]);
            String raison = c.getResponseMessage();
            if (raison == null || raison.trim().isEmpty()) raison = statut < 400 ? "OK" : "Erreur";
            return new Reponse(statut, raison, te[0], te[1], entetesRendus(brut), corps);
        } catch (IOException | RuntimeException e) {
            if (c != null) c.disconnect();
            return null;
        }
    }

    private static String valeur(Map<String, String> entetes, String nom) {
        if (entetes == null) return null;
        for (Map.Entry<String, String> e : entetes.entrySet()) {
            if (e.getKey() != null && e.getKey().equalsIgnoreCase(nom)) return e.getValue();
        }
        return null;
    }

    private static boolean dans(String[] liste, String nom) {
        for (String s : liste) if (s.equals(nom)) return true;
        return false;
    }
}
