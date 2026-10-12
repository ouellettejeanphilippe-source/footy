package ca.local.footy;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Random;
import java.util.zip.CRC32;
import java.util.zip.DeflaterOutputStream;
import java.util.zip.GZIPOutputStream;

import org.junit.Test;

/**
 * Les segments de DaddyLive / Pandastream (12 octobre 2026) : un PNG dont les pixels,
 * filtres défaits, portent « TIKTIKPX » + longueur + gzip du MPEG-TS. L'image est
 * fabriquée ici de la même façon, avec les cinq filtres de ligne (le vrai segment les
 * emploie tous), pour que le déballage soit éprouvé sans réseau. Vérifié aussi sur un
 * vrai segment du 12 octobre : 2 000 320 octets de TS, identiques au décodage de
 * référence.
 */
public class SegmentImageTest {

    /** Un faux flux MPEG-TS : n paquets de 188 octets commençant par 0x47. */
    static byte[] fluxTs(int paquets) {
        byte[] ts = new byte[paquets * 188];
        new Random(42).nextBytes(ts);
        for (int i = 0; i < ts.length; i += 188) ts[i] = 0x47;
        return ts;
    }

    static byte[] gzip(byte[] b) throws IOException {
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        try (GZIPOutputStream g = new GZIPOutputStream(o)) { g.write(b); }
        return o.toByteArray();
    }

    static void chunk(ByteArrayOutputStream png, String type, byte[] d) {
        byte[] t = type.getBytes(StandardCharsets.US_ASCII);
        ecrireU32(png, d.length);
        png.write(t, 0, 4);
        png.write(d, 0, d.length);
        CRC32 crc = new CRC32();
        crc.update(t);
        crc.update(d);
        ecrireU32(png, (int) crc.getValue());
    }

    static void ecrireU32(ByteArrayOutputStream o, int v) {
        o.write(v >>> 24); o.write(v >>> 16); o.write(v >>> 8); o.write(v);
    }

    static int paeth(int a, int b, int c) {
        int p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        return (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
    }

    /** PNG RVB 8 bits dont les pixels sont {@code charge}, filtre de la ligne y = y % 5. */
    static byte[] png(byte[] charge, int largeur) throws IOException {
        int bpp = 3, pas = largeur * bpp;
        int hauteur = (charge.length + pas - 1) / pas;
        byte[] px = new byte[hauteur * pas];
        System.arraycopy(charge, 0, px, 0, charge.length);
        ByteArrayOutputStream brut = new ByteArrayOutputStream();
        for (int y = 0; y < hauteur; y++) {
            int f = y % 5;
            brut.write(f);
            for (int x = 0; x < pas; x++) {
                int v = px[y * pas + x] & 0xff;
                int a = x >= bpp ? px[y * pas + x - bpp] & 0xff : 0;
                int u = y > 0 ? px[(y - 1) * pas + x] & 0xff : 0;
                int c = (y > 0 && x >= bpp) ? px[(y - 1) * pas + x - bpp] & 0xff : 0;
                int p = f == 0 ? 0 : f == 1 ? a : f == 2 ? u : f == 3 ? (a + u) >> 1 : paeth(a, u, c);
                brut.write((v - p) & 0xff);
            }
        }
        ByteArrayOutputStream z = new ByteArrayOutputStream();
        try (DeflaterOutputStream d = new DeflaterOutputStream(z)) { brut.writeTo(d); }
        byte[] zlib = z.toByteArray();

        ByteArrayOutputStream png = new ByteArrayOutputStream();
        png.write(SegmentImage.SIGNATURE_PNG, 0, 8);
        ByteArrayOutputStream ihdr = new ByteArrayOutputStream();
        ecrireU32(ihdr, largeur); ecrireU32(ihdr, hauteur);
        ihdr.write(8); ihdr.write(2); ihdr.write(0); ihdr.write(0); ihdr.write(0);
        chunk(png, "IHDR", ihdr.toByteArray());
        for (int i = 0; i < zlib.length; i += 8192) {   // IDAT de 8 Ko, comme le vrai
            byte[] morceau = java.util.Arrays.copyOfRange(zlib, i, Math.min(zlib.length, i + 8192));
            chunk(png, "IDAT", morceau);
        }
        chunk(png, "IEND", new byte[0]);
        return png.toByteArray();
    }

    static byte[] enveloppeTiktik(byte[] ts) throws IOException {
        byte[] gz = gzip(ts);
        ByteArrayOutputStream c = new ByteArrayOutputStream();
        c.write(SegmentImage.MAGIE.getBytes(StandardCharsets.US_ASCII));
        ecrireU32(c, gz.length);
        c.write(gz);
        return c.toByteArray();
    }

    @Test
    public void deballeLeFluxPorteParLesPixels() throws IOException {
        byte[] ts = fluxTs(400);
        byte[] image = png(enveloppeTiktik(ts), 512);
        assertTrue(SegmentImage.estImage(image, image.length));
        assertArrayEquals(ts, SegmentImage.deballer(image));
    }

    @Test
    public void accepteUnFluxSansEnTete() throws IOException {
        byte[] ts = fluxTs(50);
        byte[] avecBourre = new byte[ts.length + 27];
        System.arraycopy(ts, 0, avecBourre, 27, ts.length);
        byte[] sortie = SegmentImage.deballer(png(avecBourre, 64));
        assertEquals(0x47, sortie[0] & 0xff);
        assertEquals(0x47, sortie[188] & 0xff);
    }

    @Test
    public void unSegmentOrdinaireNEstPasUneImage() {
        byte[] ts = fluxTs(3);
        assertFalse(SegmentImage.estImage(ts, ts.length));
        assertFalse(SegmentImage.estImage(SegmentImage.SIGNATURE_PNG, 7));
    }

    @Test
    public void uneImageSansVideoEstRefusee() throws IOException {
        byte[] image = png(new byte[3000], 32);
        try {
            SegmentImage.deballer(image);
            fail("une image vide ne doit pas passer pour de la vidéo");
        } catch (IOException attendu) {
            assertTrue(attendu.getMessage().contains("sans vidéo"));
        }
    }
}
