package ca.local.footy;

import java.io.BufferedInputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Le {@code Referer} des flux directs joués dans la tuile (js/multiview.js, entetesRelais).
 *
 * <p>« Le mode direct… ça part en mode câble sur ma télé » ; « y marche pas à date, et ça
 * chie avec le reste du UI » (25 octobre 2026). Le flux direct joue maintenant dans sa
 * tuile, par hls.js, comme sur le site, au lieu du lecteur natif plein écran. Capacitor
 * (CapacitorHttp) fait passer les requêtes de la page par une adresse interne,
 * {@code /_capacitor_http_interceptor_?u=…}, puis par le réseau d'Android, sans CORS. La
 * plupart des CDN de ces flux exigent le {@code Referer} de la page de leur lecteur, qu'une
 * page ne peut pas poser : hls.js le met dans {@code X-Footy-Referer} (et l'origine dans
 * {@code X-Footy-Origin}), et ceci le remet à sa place avant que Capacitor ne parte
 * chercher le flux. Une valeur vide veut dire « sans Referer ».
 *
 * <p>Les segments déguisés en image (famille DaddyLive / Pandastream, {@link SegmentImage}),
 * que le lecteur natif déballait ({@link DataSourceDeballante}), le sont ici, au passage
 * ({@link #deballer}) : hls.js reçoit le MPEG-TS.
 *
 * <p>Java pur, sans Android : testé sur la JVM comme {@link CadreSansRefus}.
 */
final class RelaisReferer {

    static final String CHEMIN = "/_capacitor_http_interceptor_";
    static final String ENTETE_REFERER = "X-Footy-Referer";
    static final String ENTETE_ORIGINE = "X-Footy-Origin";

    private RelaisReferer() {}

    /** Les en-têtes à transmettre, ou {@code null} quand il n'y a rien à changer. */
    static Map<String, String> recrire(String chemin, Map<String, String> entetes) {
        if (chemin == null || !chemin.startsWith(CHEMIN) || entetes == null) return null;
        String referer = null, origine = null;
        boolean vu = false;
        Map<String, String> sortie = new LinkedHashMap<>();
        for (Map.Entry<String, String> e : entetes.entrySet()) {
            String k = e.getKey();
            if (k == null) continue;
            if (k.equalsIgnoreCase(ENTETE_REFERER)) { referer = e.getValue(); vu = true; }
            else if (k.equalsIgnoreCase(ENTETE_ORIGINE)) { origine = e.getValue(); vu = true; }
            else sortie.put(k, e.getValue());
        }
        if (!vu) return null;
        // Celui de la WebView (la page de l'application) ne vaut rien pour le CDN.
        sortie.keySet().removeIf(k -> k.equalsIgnoreCase("Referer") || k.equalsIgnoreCase("Origin"));
        if (referer != null && !referer.isEmpty()) sortie.put("Referer", referer);
        if (origine != null && !origine.isEmpty()) sortie.put("Origin", origine);
        return sortie;
    }

    /** Le corps d'une réponse relayée, et s'il venait d'une image. */
    static final class Corps {
        final InputStream flux;
        final boolean image;
        Corps(InputStream flux, boolean image) { this.flux = flux; this.image = image; }
    }

    /**
     * Lit huit octets d'avance : une image PNG est déballée en entier (SegmentImage),
     * tout le reste (manifeste, clé, segment ordinaire) repart tel quel, sans être lu.
     */
    static Corps deballer(InputStream entree) throws IOException {
        BufferedInputStream b = new BufferedInputStream(entree, 16);
        b.mark(8);
        byte[] tete = new byte[8];
        int n = 0;
        while (n < 8) {
            int r = b.read(tete, n, 8 - n);
            if (r < 0) break;
            n += r;
        }
        b.reset();
        if (!SegmentImage.estImage(tete, n)) return new Corps(b, false);
        ByteArrayOutputStream tout = new ByteArrayOutputStream();
        byte[] tampon = new byte[64 * 1024];
        int r;
        while ((r = b.read(tampon)) > 0) {
            tout.write(tampon, 0, r);
            if (tout.size() > SegmentImage.TAILLE_MAX) throw new IOException("image trop grosse");
        }
        return new Corps(new ByteArrayInputStream(SegmentImage.deballer(tout.toByteArray())), true);
    }
}
