package ca.local.footy;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class DecodeurTest {

    @Test public void lesDecodeursDeLaPuceSontMateriels() {
        assertFalse(Decodeur.estLogiciel("c2.amlogic.avc.decoder"));
        assertFalse(Decodeur.estLogiciel("OMX.amlogic.avc.decoder.awesome2"));
        assertFalse(Decodeur.estLogiciel("c2.qti.avc.decoder"));
        assertTrue(Decodeur.ligne("c2.amlogic.avc.decoder").endsWith("(matériel)"));
    }

    @Test public void lesDecodeursDAndroidSontLogiciels() {
        assertTrue(Decodeur.estLogiciel("c2.android.avc.decoder"));
        assertTrue(Decodeur.estLogiciel("OMX.google.h264.decoder"));
        assertTrue(Decodeur.estLogiciel("OMX.SEC.avc.sw.dec"));
        assertTrue(Decodeur.estLogiciel("libdav1d"));
        assertTrue(Decodeur.ligne("c2.android.avc.decoder").contains("LOGICIEL"));
        assertFalse(Decodeur.estLogiciel(null));
    }
}
