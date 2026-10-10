package ca.local.footy;

import android.content.pm.PackageInfo;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;
import androidx.webkit.WebViewCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Le point d'entrée de l'application Android.
 *
 * <p>Ce qu'il ajoute à Capacitor :
 * <ul>
 * <li>le blocage des publicités : on remplace le client de la WebView par le nôtre, qui
 * HÉRITE de celui de Capacitor et ne fait que refuser les requêtes vers les hôtes de
 * publicité et de pistage. Tout le reste redescend à {@code super}, donc le pont et le
 * serveur local restent intacts. Il signale aussi la télé à l'application
 * ({@link BloqueurWebViewClient#onPageFinished}) ;</li>
 * <li>le script utilisateur (multiview-cleaner.user.js) posé dans chaque cadre avant
 * ses propres scripts ({@link NettoyeurLecteurs}), et le verrou de navigation
 * ({@link GardeNavigation}) ;</li>
 * <li>le lecteur natif ({@link LecteurNatifPlugin}), enregistré AVANT
 * {@code super.onCreate}, comme Capacitor l'exige ;</li>
 * <li>la touche Retour, qui demande d'abord à l'application de fermer ce qui est ouvert
 * ({@code window.retourTele}, js/main.js), et ne quitte que si elle répond qu'il n'y a
 * plus rien.</li>
 * </ul>
 *
 * <p>Le client de la WebView est posé après {@code super.onCreate} et pas avant : c'est
 * lui qui crée le pont et la WebView.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle etat) {
        registerPlugin(LecteurNatifPlugin.class);
        super.onCreate(etat);
        BloqueurWebViewClient client = new BloqueurWebViewClient(getBridge(), this);
        getBridge().setWebViewClient(client);

        WebView vue = getBridge().getWebView();
        /* Les cookies TIERS : chaque lecteur est un site tiers pour l'application, et la
           WebView les refuse par défaut, là où Chrome les accepte. Beaucoup de lecteurs
           posent un cookie de session avant de servir leur flux ; sans lui, la page
           s'affiche et la vidéo ne part pas. */
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(vue, true);
        PackageInfo webview = WebViewCompat.getCurrentWebViewPackage(this);
        Journal.etat("webview", webview == null ? "inconnue" : webview.packageName + " " + webview.versionName);
        Journal.etat("cookiesTiers", "acceptés");

        // Le script utilisateur dans chaque lecteur, sans Tampermonkey (NettoyeurLecteurs).
        String nettoyeur = NettoyeurLecteurs.assembler(this);
        NettoyeurLecteurs.installer(vue, nettoyeur);
        client.setNettoyeur(nettoyeur);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                getBridge().getWebView().evaluateJavascript(
                        "(function(){try{return !!(window.retourTele && window.retourTele());}catch(e){return false;}})()",
                        reponse -> {
                            if ("true".equals(reponse)) return;
                            // Plus rien à fermer : on rend la main au système, qui quitte.
                            setEnabled(false);
                            getOnBackPressedDispatcher().onBackPressed();
                            setEnabled(true);
                        });
            }
        });
    }
}
