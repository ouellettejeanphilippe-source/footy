package ca.local.footy;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.zip.DataFormatException;
import java.util.zip.GZIPInputStream;
import java.util.zip.Inflater;

/**
 * Segments vidéo déguisés en image PNG (12 octobre 2026, « le vidéo charge pas »).
 *
 * <p>La famille DaddyLive / Pandastream (manifestes {@code edge.cowedd4855ws.sbs}) sert
 * chaque segment depuis le CDN de TikTok sous la forme d'un vrai PNG. La vidéo est dans
 * les pixels :
 *
 * <pre>
 *   PNG (IDAT en zlib, filtres de ligne 0 à 4)
 *     └─ pixels, filtres défaits : « TIKTIKPX » + longueur (32 bits) + gzip
 *          └─ MPEG-TS (H.264 + AAC)
 * </pre>
 *
 * <p>ExoPlayer, qui ne cherche la synchronisation TS que dans les premiers octets, reçoit
 * une image et ne démarre jamais. Relevé le même jour : 15 des 31 flux directs joignables
 * du cache. Cette classe défait l'enveloppe ; {@link DataSourceDeballante} l'applique
 * aux réponses du lecteur.
 *
 * <p>Java pur (aucune dépendance Android) : testée sur la JVM. Le même fichier existe dans
 * l'appli tv/ ; {@code tests/unit_segmentimage.test.js} vérifie que les deux restent
 * identiques.
 */
public final class SegmentImage {

    private SegmentImage() {}

    static final byte[] SIGNATURE_PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a};
    static final String MAGIE = "TIKTIKPX";
    /** Garde-fou : un segment de quelques secondes ne pèse pas 64 Mo. */
    static final int TAILLE_MAX = 64 * 1024 * 1024;

    /** Les {@code n} premiers octets d'{@code b} sont-ils la signature PNG ? */
    public static boolean estImage(byte[] b, int n) {
        if (b == null || n < 8) return false;
        for (int i = 0; i < 8; i++) if (b[i] != SIGNATURE_PNG[i]) return false;
        return true;
    }

    private static int u32(byte[] b, int i) {
        return ((b[i] & 0xff) << 24) | ((b[i + 1] & 0xff) << 16) | ((b[i + 2] & 0xff) << 8) | (b[i + 3] & 0xff);
    }

    /** Le flux vidéo porté par l'image {@code png}. */
    public static byte[] deballer(byte[] png) throws IOException {
        if (!estImage(png, png.length)) throw new IOException("pas une image PNG");
        int p = 8, largeur = 0, hauteur = 0, profondeur = 0, couleur = -1, entrelace = 0;
        ByteArrayOutputStream z = new ByteArrayOutputStream(png.length);
        while (p + 8 <= png.length) {
            int longueur = u32(png, p);
            String type = new String(png, p + 4, 4, java.nio.charset.StandardCharsets.US_ASCII);
            int debut = p + 8;
            if (longueur < 0 || debut + longueur > png.length) throw new IOException("PNG tronqué");
            if (type.equals("IHDR")) {
                largeur = u32(png, debut);
                hauteur = u32(png, debut + 4);
                profondeur = png[debut + 8] & 0xff;
                couleur = png[debut + 9] & 0xff;
                entrelace = png[debut + 12] & 0xff;
            } else if (type.equals("IDAT")) {
                z.write(png, debut, longueur);
            } else if (type.equals("IEND")) {
                break;
            }
            p = debut + longueur + 4;   // CRC
        }
        int bpp = couleur == 0 ? 1 : couleur == 2 ? 3 : couleur == 4 ? 2 : couleur == 6 ? 4 : 0;
        if (profondeur != 8 || bpp == 0 || entrelace != 0 || largeur <= 0 || hauteur <= 0) {
            throw new IOException("PNG non pris en charge");
        }
        long pas = (long) largeur * bpp;
        long attendu = hauteur * (pas + 1);
        if (attendu > TAILLE_MAX) throw new IOException("image trop grande");
        byte[] brut = inflate(z.toByteArray(), (int) attendu);
        return fluxDesPixels(defiltrer(brut, largeur, hauteur, bpp));
    }

    static byte[] inflate(byte[] donnees, int attendu) throws IOException {
        Inflater inf = new Inflater();
        try {
            inf.setInput(donnees);
            byte[] sortie = new byte[attendu];
            int n = 0;
            while (n < attendu && !inf.finished()) {
                int lu = inf.inflate(sortie, n, attendu - n);
                if (lu == 0 && (inf.needsInput() || inf.needsDictionary())) break;
                n += lu;
            }
            if (n < attendu) throw new IOException("image incomplète");
            return sortie;
        } catch (DataFormatException e) {
            throw new IOException("zlib illisible", e);
        } finally {
            inf.end();
        }
    }

    /** Défait les filtres de ligne PNG : aucun, Sub, Up, Average, Paeth. */
    static byte[] defiltrer(byte[] brut, int largeur, int hauteur, int bpp) throws IOException {
        int pas = largeur * bpp;
        byte[] s = new byte[hauteur * pas];
        for (int y = 0; y < hauteur; y++) {
            int f = brut[y * (pas + 1)] & 0xff;
            int src = y * (pas + 1) + 1, dst = y * pas, haut = dst - pas;
            for (int x = 0; x < pas; x++) {
                int a = x >= bpp ? s[dst + x - bpp] & 0xff : 0;
                int u = y > 0 ? s[haut + x] & 0xff : 0;
                int c = (y > 0 && x >= bpp) ? s[haut + x - bpp] & 0xff : 0;
                int v = brut[src + x] & 0xff;
                switch (f) {
                    case 0: break;
                    case 1: v += a; break;
                    case 2: v += u; break;
                    case 3: v += (a + u) >> 1; break;
                    case 4: {
                        int pp = a + u - c, pa = Math.abs(pp - a), pb = Math.abs(pp - u), pc = Math.abs(pp - c);
                        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? u : c);
                        break;
                    }
                    default: throw new IOException("filtre PNG inconnu " + f);
                }
                s[dst + x] = (byte) v;
            }
        }
        return s;
    }

    /** Premier paquet MPEG-TS (0x47 tous les 188 octets, trois fois) avant {@code limite}, ou -1. */
    static int debutTs(byte[] b, int limite) {
        int max = Math.min(b.length - 3 * 188, limite);
        for (int i = 0; i < max; i++) {
            if (b[i] == 0x47 && b[i + 188] == 0x47 && b[i + 376] == 0x47) return i;
        }
        return -1;
    }

    /** « TIKTIKPX » + longueur + gzip ; à défaut, un flux TS posé tel quel dans les pixels. */
    static byte[] fluxDesPixels(byte[] px) throws IOException {
        if (px.length >= 12 && MAGIE.equals(new String(px, 0, 8, java.nio.charset.StandardCharsets.US_ASCII))) {
            int n = u32(px, 8);
            if (n < 0 || 12 + n > px.length) throw new IOException("longueur annoncée hors image");
            if (n >= 2 && (px[12] & 0xff) == 0x1f && (px[13] & 0xff) == 0x8b) {
                try (GZIPInputStream gz = new GZIPInputStream(new java.io.ByteArrayInputStream(px, 12, n))) {
                    ByteArrayOutputStream sortie = new ByteArrayOutputStream(n * 2);
                    byte[] tampon = new byte[64 * 1024];
                    int lu;
                    while ((lu = gz.read(tampon)) > 0) {
                        sortie.write(tampon, 0, lu);
                        if (sortie.size() > TAILLE_MAX) throw new IOException("vidéo trop grande");
                    }
                    return sortie.toByteArray();
                }
            }
            byte[] brut = new byte[n];
            System.arraycopy(px, 12, brut, 0, n);
            return brut;
        }
        int i = debutTs(px, 4096);
        if (i < 0) throw new IOException("image sans vidéo reconnue");
        byte[] ts = new byte[px.length - i];
        System.arraycopy(px, i, ts, 0, ts.length);
        return ts;
    }
}
