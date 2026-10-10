package ca.local.footytv;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.time.ZoneId;
import java.util.Arrays;

import org.json.JSONException;
import org.junit.Test;

public class ListeTest {

    static final String JSON = "{\"version\":1,\"generee\":\"2026-10-10T14:00:00Z\",\"agent\":\"UA\",\"matchs\":["
            + "{\"ligue\":\"Premier League\",\"domicile\":\"Arsenal\",\"exterieur\":\"Leeds\",\"date\":\"2026-10-10\",\"heure\":\"10:00\",\"statut\":\"live\","
            + "\"liens\":[{\"nom\":\"A\",\"media\":\"https://cdn/a.m3u8\",\"referer\":\"https://xstream.st/\",\"page\":\"https://site/p\"},{\"nom\":\"vide\",\"media\":\"\"}]},"
            + "{\"ligue\":\"NHL\",\"domicile\":\"X\",\"exterieur\":\"Y\",\"liens\":[]}]}";

    @Test public void litLesMatchsEtIgnoreCeQuiNeJouePas() throws Exception {
        Liste l = Liste.lire(JSON);
        assertEquals("UA", l.agent);
        assertEquals(1, l.matchs.size());               // le match sans lien est écarté
        assertEquals(1, l.matchs.get(0).liens.size());  // le lien sans manifeste aussi
        assertEquals("Arsenal – Leeds", l.matchs.get(0).titre());
        assertTrue(l.matchs.get(0).enDirect());
    }

    @Test(expected = JSONException.class)
    public void refuseUneAutreVersion() throws Exception {
        Liste.lire("{\"version\":2,\"matchs\":[]}");
    }

    @Test public void essaieLeCadreDuLecteurPuisRienPuisLaPage() {
        Liste.Lien l = new Liste.Lien("A", "s", "https://cdn/a.m3u8", "https://xstream.st/", "https://site/p");
        assertEquals(Arrays.asList("https://xstream.st/", "", "https://site/p"), Liste.referers(l));
        Liste.Lien sans = new Liste.Lien("A", "s", "https://cdn/a.m3u8", "", "https://site/p");
        assertEquals(Arrays.asList("", "https://site/p"), Liste.referers(sans));
    }

    @Test public void origineCommeUnNavigateur() {
        assertEquals("https://xstream.st", Liste.origine("https://xstream.st/embed?x=1"));
        assertEquals("https://h.net:8443", Liste.origine("https://h.net:8443/a"));
        assertEquals("", Liste.origine("pas une adresse"));
    }

    @Test public void heureDeNewYorkDansLeFuseauDeLaTele() throws Exception {
        Liste.Match m = Liste.lire(JSON).matchs.get(0);
        assertEquals("10:00", Liste.heureLocale(m, ZoneId.of("America/Toronto")));
        assertEquals("16:00", Liste.heureLocale(m, ZoneId.of("Europe/Paris")));
    }

    @Test public void leModeCableRepartDuDernierMatchRegarde() throws Exception {
        String deux = JSON.replace("{\"ligue\":\"NHL\",\"domicile\":\"X\",\"exterieur\":\"Y\",\"liens\":[]}",
                "{\"ligue\":\"NHL\",\"domicile\":\"X\",\"exterieur\":\"Y\",\"date\":\"2026-10-10\",\"liens\":[{\"media\":\"https://cdn/x.m3u8\"}]}");
        Liste l = Liste.lire(deux);
        assertEquals(2, l.matchs.size());
        assertEquals(1, Liste.matchDeDepart(l, Liste.cle(l.matchs.get(1))));
        assertEquals(0, Liste.matchDeDepart(l, "match fini depuis"));
        assertEquals(0, Liste.matchDeDepart(l, ""));
        assertEquals(-1, Liste.indexDe(l, "inconnu"));
    }
}
