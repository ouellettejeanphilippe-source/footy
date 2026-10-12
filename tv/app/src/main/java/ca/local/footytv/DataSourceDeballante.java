package ca.local.footytv;

import android.net.Uri;

import androidx.media3.common.C;
import androidx.media3.datasource.DataSource;
import androidx.media3.datasource.DataSpec;
import androidx.media3.datasource.TransferListener;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Source de données du lecteur natif qui déballe les segments déguisés en image
 * ({@link SegmentImage}). Le manifeste, les clés et un segment ordinaire passent tels
 * quels : seuls les huit premiers octets sont lus d'avance pour reconnaître un PNG.
 *
 * <p>Une reprise au milieu d'un segment ({@code position > 0}) ne voit pas la signature :
 * pour une adresse déjà reconnue comme image, on relit l'image entière et on saute dans
 * le flux déballé.
 */
public final class DataSourceDeballante implements DataSource {

    /** Fabrique : enveloppe celle du lecteur (HTTP, avec ses Referer). */
    public static final class Factory implements DataSource.Factory {
        private final DataSource.Factory amont;
        public Factory(DataSource.Factory amont) { this.amont = amont; }
        @Override public DataSource createDataSource() { return new DataSourceDeballante(amont.createDataSource()); }
    }

    /** Adresses déjà reconnues comme images (les 256 dernières). */
    private static final Set<String> IMAGES = Collections.synchronizedSet(Collections.newSetFromMap(
            new LinkedHashMap<String, Boolean>() {
                @Override protected boolean removeEldestEntry(Map.Entry<String, Boolean> e) { return size() > 256; }
            }));

    private final DataSource amont;
    private byte[] tete;          // octets lus d'avance, à rendre avant le reste (passage tel quel)
    private int iTete, nTete;
    private byte[] deballe;       // flux vidéo déballé, quand c'était une image
    private int iDeballe;
    private boolean ouvert;

    DataSourceDeballante(DataSource amont) { this.amont = amont; }

    @Override public void addTransferListener(TransferListener l) { amont.addTransferListener(l); }

    @Override
    public long open(DataSpec spec) throws IOException {
        deballe = null; tete = null; iTete = nTete = 0; iDeballe = 0;
        String cle = spec.uri.toString();
        if (spec.position > 0 && IMAGES.contains(cle)) {
            DataSpec entier = spec.buildUpon().setPosition(0).setLength(C.LENGTH_UNSET).build();
            amont.open(entier);
            ouvert = true;
            return servirImage(lireTout(new byte[0], 0), spec);
        }
        long longueur = amont.open(spec);
        ouvert = true;
        if (spec.position > 0) return longueur;
        byte[] debut = new byte[8];
        int n = 0;
        while (n < 8) {
            int lu = amont.read(debut, n, 8 - n);
            if (lu == C.RESULT_END_OF_INPUT) break;
            n += lu;
        }
        if (!SegmentImage.estImage(debut, n)) {
            tete = debut; nTete = n;
            return longueur;
        }
        IMAGES.add(cle);
        return servirImage(lireTout(debut, n), spec);
    }

    private byte[] lireTout(byte[] debut, int n) throws IOException {
        ByteArrayOutputStream tout = new ByteArrayOutputStream(2 * 1024 * 1024);
        tout.write(debut, 0, n);
        byte[] tampon = new byte[64 * 1024];
        int lu;
        while ((lu = amont.read(tampon, 0, tampon.length)) != C.RESULT_END_OF_INPUT) {
            tout.write(tampon, 0, lu);
            if (tout.size() > SegmentImage.TAILLE_MAX) throw new IOException("segment image trop grand");
        }
        return tout.toByteArray();
    }

    private long servirImage(byte[] png, DataSpec spec) throws IOException {
        deballe = SegmentImage.deballer(png);
        iDeballe = (int) Math.min(spec.position, deballe.length);
        long reste = deballe.length - iDeballe;
        if (spec.length != C.LENGTH_UNSET) reste = Math.min(reste, spec.length);
        return reste;
    }

    @Override
    public int read(byte[] cible, int decalage, int longueur) throws IOException {
        if (longueur == 0) return 0;
        if (deballe != null) {
            if (iDeballe >= deballe.length) return C.RESULT_END_OF_INPUT;
            int n = Math.min(longueur, deballe.length - iDeballe);
            System.arraycopy(deballe, iDeballe, cible, decalage, n);
            iDeballe += n;
            return n;
        }
        if (tete != null && iTete < nTete) {
            int n = Math.min(longueur, nTete - iTete);
            System.arraycopy(tete, iTete, cible, decalage, n);
            iTete += n;
            return n;
        }
        return amont.read(cible, decalage, longueur);
    }

    @Override public Uri getUri() { return amont.getUri(); }

    @Override public Map<String, List<String>> getResponseHeaders() { return amont.getResponseHeaders(); }

    @Override
    public void close() throws IOException {
        deballe = null; tete = null;
        if (ouvert) { ouvert = false; amont.close(); }
    }
}
