package ca.local.footy;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;

import org.junit.Test;

/**
 * La règle de blocage, éprouvée sans téléphone ni émulateur.
 *
 * <p>C'est la raison d'être de {@link ListeDeBlocage} : la décision est une fonction pure
 * d'un nom d'hôte, donc elle s'éprouve ici, par {@code gradlew testDebugUnitTest}. La
 * colle Android ({@link BloqueurWebViewClient}) ne fait que la brancher.
 *
 * <p>Ce que ces tests protègent avant tout : le sur-blocage. Une publicité qui passe est
 * un désagrément ; un flux vidéo bloqué par erreur est une application cassée.
 */
public class ListeDeBlocageTest {

    private static ListeDeBlocage avec(String... hotes) {
        return new ListeDeBlocage(new HashSet<>(Arrays.asList(hotes)));
    }

    @Test
    public void bloqueLHoteExact() {
        ListeDeBlocage l = avec("doubleclick.net");
        assertTrue(l.estBloque("doubleclick.net"));
    }

    @Test
    public void bloqueLesSousDomaines() {
        // Les régies ne servent presque jamais depuis le domaine nu : sans cette règle,
        // la liste ne bloquerait à peu près rien.
        ListeDeBlocage l = avec("doubleclick.net");
        assertTrue(l.estBloque("ads.doubleclick.net"));
        assertTrue(l.estBloque("pagead2.g.doubleclick.net"));
    }

    @Test
    public void neConfondPasUnSuffixeAvecUnSousDomaine() {
        /* « monexemple.com » se termine par « exemple.com » sans en être un
           sous-domaine. Comparer les chaînes bloquerait des sites innocents — c'est
           l'erreur classique de ce genre de liste. */
        ListeDeBlocage l = avec("exemple.com");
        assertFalse(l.estBloque("monexemple.com"));
        assertFalse(l.estBloque("pasexemple.com"));
        assertTrue(l.estBloque("a.exemple.com"));
    }

    @Test
    public void neBloqueJamaisSurUnSeulNiveau() {
        /* Si une liste contenait « com » par accident, tout Internet tomberait. La
           remontée s'arrête avant le dernier niveau. */
        ListeDeBlocage l = avec("com", "net");
        assertFalse(l.estBloque("exemple.com"));
        assertFalse(l.estBloque("a.b.exemple.net"));
    }

    @Test
    public void ignoreLaCasseEtLePrefixeWww() {
        ListeDeBlocage l = avec("doubleclick.net");
        assertTrue(l.estBloque("ADS.DoubleClick.NET"));
        assertTrue(l.estBloque("www.doubleclick.net"));
    }

    @Test
    public void laisseToutPasserQuandLaListeEstVide() {
        ListeDeBlocage l = avec();
        assertFalse(l.estBloque("doubleclick.net"));
        assertFalse(l.estBloque(null));
        assertFalse(l.estBloque(""));
    }

    @Test
    public void nEmporteAucunHoteDontLApplicationADeBesoin() {
        /* Les domaines que l'application lit vraiment. Le générateur les retire d'office
           (voir JAMAIS dans construire-blocage.mjs) ; ce test dit ce qui se passerait
           s'ils y entraient malgré tout — et sert de liste de référence. */
        ListeDeBlocage l = avec("doubleclick.net", "googlesyndication.com");
        assertFalse(l.estBloque("site.api.espn.com"));
        assertFalse(l.estBloque("cdn.jsdelivr.net"));
        assertFalse(l.estBloque("cdnjs.cloudflare.com"));
        // Et les CDN de flux vidéo réellement observés le 26 septembre 2026.
        assertFalse(l.estBloque("cdn1.obstreamx.click"));
        assertFalse(l.estBloque("live.kinescopecdn.net"));
        assertFalse(l.estBloque("lb3.strmd.st"));
    }

    @Test
    public void litLaListeEnIgnorantVidesEtCommentaires() throws IOException {
        String contenu = "# un commentaire\n\ndoubleclick.net\n\ngoogle-analytics.com\n";
        ListeDeBlocage l = ListeDeBlocage.depuis(
                new ByteArrayInputStream(contenu.getBytes(StandardCharsets.UTF_8)));
        assertEquals(2, l.taille());
        assertTrue(l.estBloque("ssl.google-analytics.com"));
    }

    @Test
    public void extraitLHoteDUneUrl() {
        assertEquals("exemple.com", ListeDeBlocage.hoteDe("https://exemple.com/a/b?c=1"));
        assertEquals("exemple.com", ListeDeBlocage.hoteDe("http://exemple.com"));
        // Un port ne fait pas partie de l'hôte : les CDN de flux en servent souvent un
        // (https://643t8a.7odxv0l067ka.net:8443/hls/… a été observé).
        assertEquals("a.exemple.com", ListeDeBlocage.hoteDe("https://a.exemple.com:8443/hls/x.m3u8"));
        assertEquals("exemple.com", ListeDeBlocage.hoteDe("https://user:mdp@exemple.com/x"));
        assertNull(ListeDeBlocage.hoteDe("pas-une-url"));
        assertNull(ListeDeBlocage.hoteDe(null));
    }

    @Test
    public void unHoteAvecPortEstJugeSurSonNom() {
        ListeDeBlocage l = avec("pub.exemple.com");
        assertTrue(l.estBloque(ListeDeBlocage.hoteDe("https://pub.exemple.com:8443/banner.js")));
    }
}
