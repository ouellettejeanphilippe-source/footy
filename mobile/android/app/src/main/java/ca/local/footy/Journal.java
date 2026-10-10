package ca.local.footy;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Ce que l'APK a fait sur CET appareil, lisible depuis l'application (Plus → Logs,
 * « Cet appareil » → Android, via {@code LecteurNatif.diagnostic}).
 *
 * <p>« J'ai testé et aucune vidéo ne semble partir, mais au moins pas de pub ni de
 * redirections » (10 octobre 2026). Sans ordinateur branché à l'appareil, rien ne disait
 * pourquoi : le bloqueur a-t-il coupé le lecteur ? le script s'est-il posé ? le lecteur
 * natif a-t-il reçu 403 ? Ce journal le dit, sur l'écran même.
 *
 * <p>Sans Android : testé sur la JVM. Synchronisé, parce que le bloqueur écrit depuis les
 * fils réseau de la WebView.
 */
final class Journal {

    static final int MAX_LIGNES = 60;
    static final int MAX_HOTES = 12;

    private static final ArrayDeque<String> lignes = new ArrayDeque<>();
    private static final Map<String, Integer> hotesBloques = new HashMap<>();
    private static final Map<String, String> etats = new HashMap<>();
    private static int requetesBloquees = 0;
    private static int navigationsRefusees = 0;

    private Journal() {}

    static synchronized void noter(String ligne) {
        String heure = new SimpleDateFormat("HH:mm:ss", Locale.ROOT).format(new Date());
        lignes.addLast(heure + "  " + ligne);
        while (lignes.size() > MAX_LIGNES) lignes.removeFirst();
    }

    /** Un état qui se remplace (version de la WebView, script posé…). */
    static synchronized void etat(String cle, String valeur) {
        etats.put(cle, valeur);
    }

    static synchronized void requeteBloquee(String hote) {
        requetesBloquees++;
        Integer n = hotesBloques.get(hote);
        hotesBloques.put(hote, n == null ? 1 : n + 1);
    }

    static synchronized void navigationRefusee(String url, boolean fenetre) {
        navigationsRefusees++;
        noter("navigation refusée (" + (fenetre ? "fenêtre" : "cadre") + ") : " + court(url));
    }

    static String court(String url) {
        if (url == null) return "";
        return url.length() > 120 ? url.substring(0, 120) + "…" : url;
    }

    /** Les hôtes les plus bloqués, du plus au moins. */
    static synchronized List<Map.Entry<String, Integer>> plusBloques() {
        List<Map.Entry<String, Integer>> l = new ArrayList<>(hotesBloques.entrySet());
        l.sort((a, b) -> b.getValue() - a.getValue() != 0 ? b.getValue() - a.getValue() : a.getKey().compareTo(b.getKey()));
        return l.size() > MAX_HOTES ? new ArrayList<>(l.subList(0, MAX_HOTES)) : l;
    }

    static synchronized JSONObject instantane() {
        JSONObject o = new JSONObject();
        try {
            JSONObject e = new JSONObject();
            for (Map.Entry<String, String> x : etats.entrySet()) e.put(x.getKey(), x.getValue());
            o.put("etats", e);
            o.put("requetesBloquees", requetesBloquees);
            o.put("navigationsRefusees", navigationsRefusees);
            JSONArray h = new JSONArray();
            for (Map.Entry<String, Integer> x : plusBloques()) h.put(new JSONObject().put("hote", x.getKey()).put("n", x.getValue()));
            o.put("hotesBloques", h);
            JSONArray l = new JSONArray();
            for (String s : lignes) l.put(s);
            o.put("lignes", l);
        } catch (JSONException ignore) {
            // Des clés et des valeurs simples : n'arrive pas.
        }
        return o;
    }

    /** Pour les tests. */
    static synchronized void vider() {
        lignes.clear();
        hotesBloques.clear();
        etats.clear();
        requetesBloquees = 0;
        navigationsRefusees = 0;
    }
}
