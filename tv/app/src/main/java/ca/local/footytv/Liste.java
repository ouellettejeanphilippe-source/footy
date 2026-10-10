package ca.local.footytv;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Ce que dit data/tv.json (js/tvliste.js) et comment on essaie de le jouer.
 * Sans dépendance à Android : testé sur la JVM (app/src/test).
 */
final class Liste {

    /** La version de data/tv.json que cette appli sait lire. */
    static final int VERSION = 1;

    /** Fuseau des heures du fichier (toutes celles de l'application). */
    static final ZoneId NEW_YORK = ZoneId.of("America/New_York");

    static final class Lien {
        final String nom, source, media, referer, page;
        Lien(String nom, String source, String media, String referer, String page) {
            this.nom = nom; this.source = source; this.media = media; this.referer = referer; this.page = page;
        }
    }

    static final class Match {
        final String ligue, domicile, exterieur, date, heure, statut;
        final List<Lien> liens;
        Match(String ligue, String domicile, String exterieur, String date, String heure, String statut, List<Lien> liens) {
            this.ligue = ligue; this.domicile = domicile; this.exterieur = exterieur;
            this.date = date; this.heure = heure; this.statut = statut; this.liens = liens;
        }
        boolean enDirect() { return "live".equals(statut); }
        String titre() {
            if (exterieur.isEmpty()) return domicile;
            if (domicile.isEmpty()) return exterieur;
            return domicile + " – " + exterieur;
        }
    }

    final String agent;
    final String generee;
    final List<Match> matchs;

    private Liste(String agent, String generee, List<Match> matchs) {
        this.agent = agent; this.generee = generee; this.matchs = matchs;
    }

    static Liste lire(String json) throws JSONException {
        JSONObject o = new JSONObject(json);
        int v = o.optInt("version", 0);
        if (v != VERSION) throw new JSONException("version " + v + " de data/tv.json, l'appli lit la " + VERSION);
        List<Match> matchs = new ArrayList<>();
        JSONArray ms = o.optJSONArray("matchs");
        for (int i = 0; ms != null && i < ms.length(); i++) {
            JSONObject m = ms.optJSONObject(i);
            if (m == null) continue;
            List<Lien> liens = new ArrayList<>();
            JSONArray ls = m.optJSONArray("liens");
            for (int j = 0; ls != null && j < ls.length(); j++) {
                JSONObject l = ls.optJSONObject(j);
                if (l == null || l.optString("media").isEmpty()) continue;
                liens.add(new Lien(l.optString("nom"), l.optString("source"), l.optString("media"),
                        l.optString("referer"), l.optString("page")));
            }
            if (liens.isEmpty()) continue;
            matchs.add(new Match(m.optString("ligue"), m.optString("domicile"), m.optString("exterieur"),
                    m.optString("date"), m.optString("heure"), m.optString("statut"), Collections.unmodifiableList(liens)));
        }
        return new Liste(o.optString("agent"), o.optString("generee"), Collections.unmodifiableList(matchs));
    }

    /**
     * Les Referer à essayer pour un lien, dans l'ordre. Mesuré le 10 octobre 2026 sur
     * instreams.pro : 200 avec le cadre du lecteur vu par la vérification, 200 sans rien,
     * 403 avec la page du lien. D'où : le cadre, puis rien, puis la page.
     * La chaîne vide veut dire « sans Referer ».
     */
    static List<String> referers(Lien l) {
        Set<String> s = new LinkedHashSet<>();
        if (!l.referer.isEmpty()) s.add(l.referer);
        s.add("");
        if (!l.page.isEmpty()) s.add(l.page);
        return new ArrayList<>(s);
    }

    /** L'origine d'une page (schéma, hôte, port), comme l'envoie un navigateur ; "" si illisible. */
    static String origine(String page) {
        try {
            java.net.URI u = new java.net.URI(page);
            if (u.getScheme() == null || u.getHost() == null) return "";
            return u.getScheme() + "://" + u.getHost() + (u.getPort() >= 0 ? ":" + u.getPort() : "");
        } catch (Exception e) {
            return "";
        }
    }

    /** L'heure de début dans le fuseau de la télé ("" si le fichier n'en dit rien). */
    static String heureLocale(Match m, ZoneId ici) {
        try {
            ZonedDateTime ny = ZonedDateTime.of(LocalDate.parse(m.date), LocalTime.parse(m.heure), NEW_YORK);
            return ny.withZoneSameInstant(ici).format(DateTimeFormatter.ofPattern("HH:mm"));
        } catch (Exception e) {
            return m.heure;
        }
    }
}
