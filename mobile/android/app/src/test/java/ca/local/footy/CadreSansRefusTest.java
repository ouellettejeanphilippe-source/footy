package ca.local.footy;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import com.sun.net.httpserver.HttpServer;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

/**
 * Les pages qui refusent l'iframe, dans l'APK (« je veux l'APK avec les mêmes fonctions
 * que le site », 25 octobre 2026). Un vrai serveur HTTP local (celui du JDK) sert une page
 * qui refuse l'encadrement : la réponse rendue à la WebView ne doit plus porter le refus,
 * et rien d'autre ne doit changer.
 */
public class CadreSansRefusTest {

    private HttpServer serveur;
    private String base;
    private final Map<String, String> recu = new HashMap<>();

    @Before public void demarrer() throws IOException {
        serveur = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        serveur.createContext("/lecteur", ech -> {
            recu.put("cookie", ech.getRequestHeaders().getFirst("Cookie"));
            recu.put("referer", ech.getRequestHeaders().getFirst("Referer"));
            recu.put("accept-encoding", ech.getRequestHeaders().getFirst("Accept-Encoding"));
            byte[] corps = "<html><body>LECTEUR é</body></html>".getBytes(StandardCharsets.UTF_8);
            ech.getResponseHeaders().add("Content-Type", "text/html; charset=UTF-8");
            ech.getResponseHeaders().add("X-Frame-Options", "DENY");
            ech.getResponseHeaders().add("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'; img-src *");
            ech.getResponseHeaders().add("Set-Cookie", "session=abc; Path=/");
            ech.getResponseHeaders().add("Set-Cookie", "pays=ca; Path=/");
            ech.getResponseHeaders().add("Cache-Control", "no-store");
            ech.sendResponseHeaders(200, corps.length);
            try (OutputStream o = ech.getResponseBody()) { o.write(corps); }
        });
        serveur.createContext("/seul-refus", ech -> {
            ech.getResponseHeaders().add("Content-Type", "text/html");
            ech.getResponseHeaders().add("Content-Security-Policy", "frame-ancestors 'self'");
            ech.sendResponseHeaders(200, 2);
            try (OutputStream o = ech.getResponseBody()) { o.write("ok".getBytes(StandardCharsets.UTF_8)); }
        });
        serveur.createContext("/ailleurs", ech -> {
            ech.getResponseHeaders().add("Location", "/lecteur");
            ech.sendResponseHeaders(302, -1);
            ech.close();
        });
        serveur.createContext("/panne", ech -> {
            byte[] corps = "en panne".getBytes(StandardCharsets.UTF_8);
            ech.getResponseHeaders().add("X-Frame-Options", "SAMEORIGIN");
            ech.sendResponseHeaders(503, corps.length);
            try (OutputStream o = ech.getResponseBody()) { o.write(corps); }
        });
        serveur.start();
        base = "http://127.0.0.1:" + serveur.getAddress().getPort();
    }

    @After public void arreter() { serveur.stop(0); }

    private static Map<String, String> entetesDuCadre() {
        Map<String, String> h = new HashMap<>();
        h.put("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
        h.put("Referer", "https://localhost/");
        h.put("Accept-Encoding", "gzip, deflate, br");
        return h;
    }

    private static String lire(InputStream in) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] t = new byte[4096];
        int n;
        while ((n = in.read(t)) > 0) b.write(t, 0, n);
        return new String(b.toByteArray(), StandardCharsets.UTF_8);
    }

    private static List<String> noms(Map<String, String> entetes) {
        List<String> l = new ArrayList<>();
        for (String k : entetes.keySet()) l.add(k.toLowerCase(Locale.ROOT));
        return l;
    }

    private static final class FauxCookies implements CadreSansRefus.Cookies {
        final List<String> ecrits = new ArrayList<>();
        @Override public String lire(String url) { return "deja=1"; }
        @Override public void ecrire(String url, String setCookie) { ecrits.add(setCookie); }
    }

    @Test public void seuleLaPageDUnCadreEstReprise() {
        Map<String, String> page = entetesDuCadre();
        Map<String, String> script = Collections.singletonMap("Accept", "*/*");
        assertTrue(CadreSansRefus.estPageDeCadre("GET", false, page, "https://lecteur.example/embed/1"));
        assertFalse("la fenêtre principale (l'application)", CadreSansRefus.estPageDeCadre("GET", true, page, "https://localhost/"));
        assertFalse("un script, une image, un flux", CadreSansRefus.estPageDeCadre("GET", false, script, "https://cdn.example/a.js"));
        assertFalse("un formulaire envoyé", CadreSansRefus.estPageDeCadre("POST", false, page, "https://lecteur.example/"));
        assertFalse("pas du web", CadreSansRefus.estPageDeCadre("GET", false, page, "data:text/html,x"));
        assertFalse(CadreSansRefus.estPageDeCadre("GET", false, null, "https://lecteur.example/"));
    }

    @Test public void laCspGardeToutSaufFrameAncestors() {
        assertEquals("default-src 'self'; img-src *", CadreSansRefus.sansFrameAncestors("default-src 'self'; frame-ancestors 'none'; img-src *"));
        assertNull(CadreSansRefus.sansFrameAncestors("frame-ancestors 'self' https://x"));
        assertNull(CadreSansRefus.sansFrameAncestors(null));
        assertEquals("script-src 'none'", CadreSansRefus.sansFrameAncestors(" FRAME-ANCESTORS 'none' ;script-src 'none';"));
    }

    @Test public void typeEtEncodage() {
        String[] te = CadreSansRefus.typeEtEncodage("text/html; charset=\"ISO-8859-1\"");
        assertEquals("text/html", te[0]);
        assertEquals("ISO-8859-1", te[1]);
        assertEquals("utf-8", CadreSansRefus.typeEtEncodage("application/xhtml+xml")[1]);
        assertEquals("text/html", CadreSansRefus.typeEtEncodage(null)[0]);
    }

    @Test public void laPageEstRendueSansSonRefusAvecSesCookies() throws IOException {
        FauxCookies cookies = new FauxCookies();
        CadreSansRefus.Reponse r = CadreSansRefus.charger(base + "/lecteur", entetesDuCadre(), cookies, 5000);
        assertNotNull(r);
        assertEquals(200, r.statut);
        assertEquals("text/html", r.mime);
        assertEquals("UTF-8", r.encodage);
        assertEquals("<html><body>LECTEUR é</body></html>", lire(r.corps));
        List<String> n = noms(r.entetes);
        assertFalse("X-Frame-Options retiré", n.contains("x-frame-options"));
        assertFalse("Set-Cookie passe par le CookieManager, pas par la réponse", n.contains("set-cookie"));
        assertTrue("le reste est gardé", n.contains("cache-control"));
        String csp = null;
        for (Map.Entry<String, String> e : r.entetes.entrySet()) if (e.getKey().equalsIgnoreCase("content-security-policy")) csp = e.getValue();
        assertEquals("default-src 'self'; img-src *", csp);
        assertEquals("les deux cookies du serveur, rendus à la WebView", 2, cookies.ecrits.size());
        assertTrue(cookies.ecrits.contains("session=abc; Path=/"));
        assertEquals("les cookies de la WebView partent avec la requête", "deja=1", recu.get("cookie"));
        assertEquals("le Referer du cadre aussi", "https://localhost/", recu.get("referer"));
        assertNull("l'encodage n'est pas recopié : rien de compressé à rendre sans le dire", recu.get("accept-encoding"));
    }

    @Test public void uneCspQuiNeFaitQueRefuserDisparait() {
        CadreSansRefus.Reponse r = CadreSansRefus.charger(base + "/seul-refus", entetesDuCadre(), null, 5000);
        assertNotNull(r);
        assertFalse(noms(r.entetes).contains("content-security-policy"));
    }

    @Test public void uneRedirectionResteALaWebView() {
        assertNull(CadreSansRefus.charger(base + "/ailleurs", entetesDuCadre(), null, 5000));
    }

    @Test public void uneErreurDuServeurEstRendueTelleQuelle() throws IOException {
        CadreSansRefus.Reponse r = CadreSansRefus.charger(base + "/panne", entetesDuCadre(), null, 5000);
        assertNotNull(r);
        assertEquals(503, r.statut);
        assertEquals("en panne", lire(r.corps));
        assertFalse(noms(r.entetes).contains("x-frame-options"));
        assertFalse("la raison n'est jamais vide (WebResourceResponse la refuse)", r.raison.trim().isEmpty());
    }

    @Test public void uneErreurReseauResteALaWebView() {
        serveur.stop(0);
        assertNull(CadreSansRefus.charger(base + "/lecteur", entetesDuCadre(), null, 2000));
    }
}
