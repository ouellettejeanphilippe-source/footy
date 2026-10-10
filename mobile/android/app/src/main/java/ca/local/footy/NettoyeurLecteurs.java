package ca.local.footy;

import android.content.Context;
import android.util.Log;
import android.webkit.WebView;

import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

/**
 * Le script utilisateur (multiview-cleaner.user.js) dans l'APK, sans Tampermonkey.
 *
 * <p>« Intégrer le script Tampermonkey (ses fonctionnalités) dans l'APK » (10 octobre
 * 2026). Jusqu'ici, rien ne tournait dans les lecteurs sur Android : aucune page ne peut
 * injecter de script dans une iframe d'une autre origine (voir BloqueurWebViewClient).
 * La WebView, elle, le peut : {@code addDocumentStartJavaScript} pose un script dans la
 * fenêtre principale ET dans chaque iframe, quelle que soit son origine, avant le premier
 * script de la page. C'est exactement {@code @allFrames true} et
 * {@code @run-at document-start}. Les fenêtres surgissantes sont donc bloquées avant que
 * la régie ne garde sa propre référence à {@code window.open}, la vidéo se lance sans
 * clic, le son suit la tuile qu'on regarde, et le manifeste remonte à l'application.
 *
 * <p>Le script est assemblé à partir de deux fichiers embarqués :
 * {@code injection-userscript.js} (le gabarit, qui fournit {@code GM_xmlhttpRequest}) et
 * le script lui-même, à l'endroit marqué {@code __SCRIPT__}. Une WebView trop ancienne
 * pour cette fonction ne reçoit rien : l'application marche, sans nettoyage, comme avant.
 */
final class NettoyeurLecteurs {

    private static final String TAG = "Nettoyeur";
    static final String GABARIT = "public/injection-userscript.js";
    static final String SCRIPT = "public/multiview-cleaner.user.js";
    static final String MARQUE = "/*__SCRIPT__*/";

    private NettoyeurLecteurs() {}

    /** Le script complet, ou null si l'un des deux fichiers manque. */
    static String assembler(Context contexte) {
        try {
            String gabarit = lire(contexte, GABARIT);
            String script = lire(contexte, SCRIPT);
            return assembler(gabarit, script);
        } catch (IOException e) {
            Log.w(TAG, "script de nettoyage introuvable : les lecteurs ne seront pas nettoyés", e);
            return null;
        }
    }

    /** Sans Android : testé sur la JVM. */
    static String assembler(String gabarit, String script) {
        if (gabarit == null || script == null || !gabarit.contains(MARQUE)) return null;
        return gabarit.replace(MARQUE, script);
    }

    /** Pose le script pour tous les documents à venir. Vrai si la WebView le permet. */
    static boolean installer(WebView vue, String complet) {
        if (vue == null || complet == null) return false;
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            Log.w(TAG, "WebView trop ancienne (pas de DOCUMENT_START_SCRIPT) : lecteurs non nettoyés");
            return false;
        }
        // "*" : toutes les origines. Les lecteurs viennent de centaines de domaines.
        WebViewCompat.addDocumentStartJavaScript(vue, complet, Collections.singleton("*"));
        Log.i(TAG, "script de nettoyage posé dans tous les cadres");
        return true;
    }

    private static String lire(Context contexte, String chemin) throws IOException {
        try (InputStream in = contexte.getAssets().open(chemin)) {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[16 * 1024];
            for (int n; (n = in.read(buf)) > 0; ) b.write(buf, 0, n);
            return new String(b.toByteArray(), StandardCharsets.UTF_8);
        }
    }
}
