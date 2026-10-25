package ca.local.footy;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.Test;

public class RelaisRefererTest {

    private static Map<String, String> entetes(String... kv) {
        Map<String, String> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put(kv[i], kv[i + 1]);
        return m;
    }

    @Test public void leRefererDuLecteurRemplaceCeluiDeLApplication() {
        Map<String, String> r = RelaisReferer.recrire("/_capacitor_http_interceptor_",
                entetes("Referer", "https://ouellettejeanphilippe-source.github.io/footy/", "Accept", "*/*",
                        "x-footy-referer", "https://cadre.test/", "X-Footy-Origin", "https://cadre.test"));
        assertEquals("https://cadre.test/", r.get("Referer"));
        assertEquals("https://cadre.test", r.get("Origin"));
        assertEquals("*/*", r.get("Accept"));
        assertFalse(r.containsKey("x-footy-referer"));
        assertFalse(r.containsKey("X-Footy-Origin"));
    }

    @Test public void uneValeurVideVeutDireSansReferer() {
        Map<String, String> r = RelaisReferer.recrire("/_capacitor_http_interceptor_",
                entetes("referer", "https://app.test/", "X-Footy-Referer", "", "X-Footy-Origin", ""));
        assertFalse(r.containsKey("referer"));
        assertFalse(r.containsKey("Referer"));
        assertFalse(r.containsKey("Origin"));
    }

    @Test public void rienAChangerAilleurs() {
        assertNull(RelaisReferer.recrire("/_capacitor_http_interceptor_", entetes("Referer", "https://app.test/")));
        assertNull(RelaisReferer.recrire("/footy/index.html", entetes("X-Footy-Referer", "https://cadre.test/")));
        assertNull(RelaisReferer.recrire(null, entetes("X-Footy-Referer", "https://cadre.test/")));
        assertNull(RelaisReferer.recrire("/_capacitor_http_interceptor_", null));
    }

    private static byte[] tout(InputStream in) throws IOException {
        return in.readAllBytes();
    }

    @Test public void unSegmentDeguiseEnImageEstDeballe() throws IOException {
        byte[] ts = SegmentImageTest.fluxTs(200);
        byte[] image = SegmentImageTest.png(SegmentImageTest.enveloppeTiktik(ts), 512);
        RelaisReferer.Corps c = RelaisReferer.deballer(new ByteArrayInputStream(image));
        assertTrue(c.image);
        assertArrayEquals(ts, tout(c.flux));
    }

    @Test public void leResteRepartTelQuel() throws IOException {
        byte[] manifeste = "#EXTM3U\n#EXT-X-VERSION:3\n".getBytes(StandardCharsets.UTF_8);
        RelaisReferer.Corps c = RelaisReferer.deballer(new ByteArrayInputStream(manifeste));
        assertFalse(c.image);
        assertArrayEquals(manifeste, tout(c.flux));
        RelaisReferer.Corps court = RelaisReferer.deballer(new ByteArrayInputStream(new byte[] {1, 2, 3}));
        assertArrayEquals(new byte[] {1, 2, 3}, tout(court.flux));
    }
}
