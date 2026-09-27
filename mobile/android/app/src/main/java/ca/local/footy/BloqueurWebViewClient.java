package ca.local.footy;

import android.content.Context;
import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.HashSet;

/**
 * Le blocage des publicités sur Android.
 *
 * <p><b>Pourquoi du code natif.</b> La version de bureau fait tourner
 * {@code @ghostery/adblocker} dans Electron : elle voit passer chaque requête et peut
 * aussi injecter du JavaScript dans les pages des lecteurs. Sur Android, ni l'un ni
 * l'autre depuis la page — aucun navigateur mobile n'injecte de script dans une iframe
 * d'origine croisée, et il n'y a pas d'API d'extension. Le seul point d'accroche est
 * {@code shouldInterceptRequest}, ici.
 *
 * <p><b>Comment il s'accroche.</b> Capacitor pose son propre {@link BridgeWebViewClient},
 * qui sert les fichiers de l'application depuis les ressources de l'APK. On en hérite
 * plutôt que de le remplacer : tout ce qui n'est pas bloqué redescend à {@code super},
 * donc le pont et le serveur local continuent de fonctionner exactement comme avant.
 *
 * <p><b>Le chargement est différé.</b> La liste fait près de cent mille hôtes ; la lire
 * sur le fil principal retarderait l'affichage. Elle se charge donc en tâche de fond, et
 * tant qu'elle n'est pas prête rien n'est bloqué — quelques requêtes passent au
 * démarrage, ce qui vaut mieux qu'une fenêtre figée.
 *
 * <p>Voir {@link ListeDeBlocage} pour la règle elle-même, qui ne connaît pas Android et
 * s'éprouve par un test unitaire ordinaire.
 */
public class BloqueurWebViewClient extends BridgeWebViewClient {

    private static final String TAG = "Bloqueur";
    private static final String FICHIER = "public/blocage-hotes.txt";

    /** Volatile : écrit par le fil de chargement, lu par celui de la WebView. */
    private volatile ListeDeBlocage liste = null;

    private int bloquees = 0;

    /**
     * Les pages dont le manifeste a déjà été signalé. Synchronisé : les requêtes
     * arrivent sur plusieurs fils réseau à la fois.
     */
    private final java.util.Set<String> pagesSignalees =
            java.util.Collections.synchronizedSet(new HashSet<String>());

    public BloqueurWebViewClient(Bridge bridge, Context contexte) {
        super(bridge);
        charger(contexte.getApplicationContext());
    }

    private void charger(final Context contexte) {
        new Thread(() -> {
            long debut = System.currentTimeMillis();
            try (InputStream flux = contexte.getAssets().open(FICHIER)) {
                ListeDeBlocage l = ListeDeBlocage.depuis(flux);
                liste = l;
                Log.i(TAG, l.taille() + " hôtes chargés en "
                        + (System.currentTimeMillis() - debut) + " ms");
            } catch (IOException e) {
                // Sans liste, l'application marche : elle ne bloque simplement rien.
                // C'est le bon comportement — un bloqueur en panne ne doit pas empêcher
                // de regarder un match.
                liste = new ListeDeBlocage(Collections.unmodifiableSet(new HashSet<>()));
                Log.w(TAG, "liste introuvable (" + FICHIER + ") : rien ne sera bloqué", e);
            }
        }, "chargement-blocage").start();
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView vue, WebResourceRequest requete) {
        if (requete != null && requete.getUrl() != null) {
            String url = requete.getUrl().toString();
            String hote = requete.getUrl().getHost();

            ListeDeBlocage l = liste;
            if (l != null && hote != null && l.estBloque(hote)) {
                bloquees++;
                // Toutes les cent, pour pouvoir constater que ça travaille sans noyer
                // le journal : adb logcat -s Bloqueur
                if (bloquees % 100 == 0) Log.i(TAG, bloquees + " requêtes bloquées");
                return vide();
            }

            signalerSiManifeste(vue, url, requete);
        }
        return super.shouldInterceptRequest(vue, requete);
    }

    /**
     * ISOLER LA VIDÉO : c'est ce que fait vraiment cette classe.
     *
     * <p>Bloquer les régies dans une page de lecteur ne règle pas grand-chose — la page
     * reste une page, avec ses calques et ses redirections. Ce qui aide, c'est de jouer
     * le flux SEUL, dans un {@code <video>} qui n'encadre rien. C'est la conclusion
     * écrite dans js/embed-bridge.js le 5 septembre 2026 : « la vraie réponse aux pages
     * qui refusent l'iframe est ailleurs : extraire l'adresse du flux vidéo brut et la
     * jouer dans un video natif ».
     *
     * <p>Sur ordinateur, c'est le script utilisateur qui voit passer ce manifeste, depuis
     * l'intérieur de la page. Sur Android, rien ne peut y tourner — mais la WebView, elle,
     * voit toutes les requêtes. Ce hook-ci est donc l'équivalent Android du script, et
     * c'est la seule place d'où l'on puisse le faire.
     *
     * <p>Le {@code Referer} dit de quelle PAGE part la requête : c'est ce qui permet à
     * l'application de savoir quelle tuile est concernée (voir mediaVuParAndroid dans
     * js/multiview.js), puisqu'on ne peut pas se faire passer pour la fenêtre émettrice.
     */
    private void signalerSiManifeste(WebView vue, String url, WebResourceRequest requete) {
        if (vue == null || url == null) return;
        String sansRequete = url;
        int coupe = sansRequete.indexOf('?');
        if (coupe >= 0) sansRequete = sansRequete.substring(0, coupe);
        coupe = sansRequete.indexOf('#');
        if (coupe >= 0) sansRequete = sansRequete.substring(0, coupe);
        String bas = sansRequete.toLowerCase();
        if (!bas.endsWith(".m3u8") && !bas.endsWith(".mpd")) return;
        // Un manifeste de publicité n'est pas le flux du match.
        if (bas.contains("/ads/") || bas.contains("/preroll") || bas.contains("/vast")) return;

        String page = null;
        if (requete.getRequestHeaders() != null) page = requete.getRequestHeaders().get("Referer");
        if (page == null || page.isEmpty()) return;

        // Le premier manifeste vu pour une page est le manifeste maître ; les suivants
        // sont ses variantes de qualité. Sans cette garde, on appellerait la page des
        // dizaines de fois par seconde pendant toute la lecture.
        if (!pagesSignalees.add(page)) return;

        final String jsPage = pourJs(page);
        final String jsUrl = pourJs(url);
        Log.i(TAG, "manifeste vu pour " + page);
        // evaluateJavascript exige le fil de l'interface ; on est ici sur un fil réseau.
        vue.post(() -> {
            try {
                vue.evaluateJavascript(
                        "window.mediaVuParAndroid && window.mediaVuParAndroid('" + jsPage + "','" + jsUrl + "')",
                        null);
            } catch (Throwable t) {
                Log.w(TAG, "signalement impossible", t);
            }
        });
    }

    /** Échappe ce qui casserait la chaîne JavaScript. Les URL en contiennent. */
    private static String pourJs(String s) {
        return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "").replace("\r", "");
    }

    /**
     * Une réponse vide plutôt qu'une erreur : un script ou une image qui reçoit 0 octet
     * échoue proprement, là où un refus réseau déclenche chez certaines régies une
     * cascade de reprises — et chez certains lecteurs, une page anti-adblock.
     */
    private static WebResourceResponse vide() {
        WebResourceResponse r = new WebResourceResponse(
                "text/plain", "utf-8", new ByteArrayInputStream(new byte[0]));
        r.setStatusCodeAndReasonPhrase(200, "OK");
        return r;
    }
}
