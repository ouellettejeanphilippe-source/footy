package ca.local.footy;

import android.app.UiModeManager;
import android.content.Context;
import android.content.res.Configuration;
import android.util.Log;
import android.net.Uri;
import android.webkit.WebResourceError;
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

    /** Une télé (Chromecast avec Google TV) : décidé une fois, par le système. */
    private final boolean tele;

    private final Bridge pont;
    private int navigationsBloquees = 0;

    /** Le script de nettoyage complet (NettoyeurLecteurs), pour la fenêtre principale. */
    private volatile String nettoyeur = null;

    void setNettoyeur(String script) { nettoyeur = script; }

    /**
     * Les pages dont le manifeste a déjà été signalé. Synchronisé : les requêtes
     * arrivent sur plusieurs fils réseau à la fois.
     */
    private final java.util.Set<String> pagesSignalees =
            java.util.Collections.synchronizedSet(new HashSet<String>());

    public BloqueurWebViewClient(Bridge bridge, Context contexte) {
        super(bridge);
        pont = bridge;
        UiModeManager ui = (UiModeManager) contexte.getSystemService(Context.UI_MODE_SERVICE);
        tele = ui != null && ui.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;
        charger(contexte.getApplicationContext());
    }

    private void charger(final Context contexte) {
        new Thread(() -> {
            long debut = System.currentTimeMillis();
            try (InputStream flux = contexte.getAssets().open(FICHIER)) {
                ListeDeBlocage l = ListeDeBlocage.depuis(flux);
                liste = l;
                Journal.etat("bloqueur", l.taille() + " hôtes");
                Log.i(TAG, l.taille() + " hôtes chargés en "
                        + (System.currentTimeMillis() - debut) + " ms");
            } catch (IOException e) {
                // Sans liste, l'application marche : elle ne bloque simplement rien.
                // C'est le bon comportement — un bloqueur en panne ne doit pas empêcher
                // de regarder un match.
                liste = new ListeDeBlocage(Collections.unmodifiableSet(new HashSet<>()));
                Journal.etat("bloqueur", "liste introuvable : rien n'est bloqué");
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
                Journal.requeteBloquee(hote);
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
     * Sur une télé, l'application s'adapte d'elle-même (js/tele.js) : mode TV et mode
     * câble à la première ouverture, touche Retour, lecteur natif. Elle ne peut pas
     * savoir seule qu'elle est sur une télé ; on le lui dit à chaque chargement de page.
     */
    /**
     * Le verrou de navigation (GardeNavigation) : un lecteur ne peut plus emmener
     * l'application vers une régie, ni lancer une autre application. Ce qui passe
     * redescend à Capacitor.
     */
    @Override
    public boolean shouldOverrideUrlLoading(WebView vue, WebResourceRequest requete) {
        if (requete != null && requete.getUrl() != null) {
            String hoteAppli = null;
            try { hoteAppli = Uri.parse(pont.getAppUrl()).getHost(); } catch (Exception e) {}
            String url = requete.getUrl().toString();
            if (GardeNavigation.decider(url, requete.isForMainFrame(), hoteAppli) == GardeNavigation.Decision.BLOQUER) {
                navigationsBloquees++;
                Journal.navigationRefusee(url, requete.isForMainFrame());
                Log.i(TAG, "navigation refusée (" + (requete.isForMainFrame() ? "fenêtre" : "cadre") + ", "
                        + navigationsBloquees + " en tout) : " + url);
                return true;
            }
            // Un cadre qui navigue en web reste dans son cadre : surtout pas launchIntent,
            // qui l'ouvrirait dans le navigateur du système.
            if (!requete.isForMainFrame()) return false;
        }
        return super.shouldOverrideUrlLoading(vue, requete);
    }

    /**
     * Ce qui échoue dans un lecteur, au journal (Journal → Plus → Logs) : la page d'un
     * cadre ou un flux vidéo qui ne vient pas. Le reste — une image, une régie bloquée —
     * noierait ce qui compte.
     */
    @Override
    public void onReceivedError(WebView vue, WebResourceRequest requete, WebResourceError erreur) {
        super.onReceivedError(vue, requete, erreur);
        if (requete != null && compte(requete) && erreur != null) {
            Journal.noter("échec " + quoi(requete) + " : " + erreur.getDescription() + " · " + Journal.court(requete.getUrl().toString()));
        }
    }

    @Override
    public void onReceivedHttpError(WebView vue, WebResourceRequest requete, WebResourceResponse reponse) {
        super.onReceivedHttpError(vue, requete, reponse);
        if (requete != null && compte(requete) && reponse != null) {
            Journal.noter("HTTP " + reponse.getStatusCode() + " " + quoi(requete) + " · " + Journal.court(requete.getUrl().toString()));
        }
    }

    private static boolean estVideo(String url) {
        String u = url.toLowerCase();
        int q = u.indexOf('?');
        if (q >= 0) u = u.substring(0, q);
        return u.endsWith(".m3u8") || u.endsWith(".mpd") || u.endsWith(".ts") || u.endsWith(".m4s") || u.endsWith(".mp4");
    }

    private static boolean compte(WebResourceRequest r) {
        if (r.getUrl() == null) return false;
        if (estVideo(r.getUrl().toString())) return true;
        String accepte = r.getRequestHeaders() == null ? null : r.getRequestHeaders().get("Accept");
        // La page d'un cadre (un lecteur) ; la fenêtre principale est l'application.
        return !r.isForMainFrame() && accepte != null && accepte.contains("text/html");
    }

    private static String quoi(WebResourceRequest r) {
        return estVideo(r.getUrl().toString()) ? "vidéo" : "page de lecteur";
    }

    @Override
    public void onPageFinished(WebView vue, String url) {
        super.onPageFinished(vue, url);
        if (vue == null) return;
        /* Le premier document de la fenêtre principale a pu partir avant la pose du
           script (Capacitor charge l'application dans super.onCreate) : il le reçoit ici.
           Les lecteurs, créés plus tard, l'ont dès leur premier octet. Le gabarit
           n'exécute le script qu'une fois par document. */
        String n = nettoyeur;
        if (n != null) vue.evaluateJavascript(n, null);
        if (!tele) return;
        vue.evaluateJavascript(
                "window.__ANDROID_TV__ = true; window.activerTeleAndroid && window.activerTeleAndroid();",
                null);
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
        Journal.noter("manifeste vu : " + Journal.court(url) + " (page " + Journal.court(page) + ")");
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
