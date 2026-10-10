package ca.local.footy;

import static ca.local.footy.GardeNavigation.Decision.BLOQUER;
import static ca.local.footy.GardeNavigation.Decision.LAISSER;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class GardeNavigationTest {

    @Test public void laFenetrePrincipaleNeQuittePasLApplication() {
        assertEquals(LAISSER, GardeNavigation.decider("https://localhost/index.html", true, "localhost"));
        assertEquals(BLOQUER, GardeNavigation.decider("https://regie.example/pop?x=1", true, "localhost"));
        assertEquals(BLOQUER, GardeNavigation.decider("intent://scan/#Intent;scheme=zxing;end", true, "localhost"));
        assertEquals(BLOQUER, GardeNavigation.decider("pas une adresse ::", true, "localhost"));
    }

    @Test public void unLecteurNavigueEnWebMaisNeLancePasDApplication() {
        assertEquals(LAISSER, GardeNavigation.decider("https://player.example/embed/2", false, "localhost"));
        assertEquals(LAISSER, GardeNavigation.decider("about:blank", false, "localhost"));
        assertEquals(BLOQUER, GardeNavigation.decider("market://details?id=casino", false, "localhost"));
        assertEquals(BLOQUER, GardeNavigation.decider("intent://x#Intent;end", false, "localhost"));
    }

    @Test public void leScriptEstPoseALaPlaceDeSaMarque() {
        String g = "(function(){ var GM = 1;\n/*__SCRIPT__*/\n})();";
        String complet = NettoyeurLecteurs.assembler(g, "console.log('$1 \\\\ ok');");
        assertNotNull(complet);
        assertTrue(complet.contains("console.log('$1 \\\\ ok');"));   // remplacement littéral
        assertNull("sans marque, rien n'est assemblé", NettoyeurLecteurs.assembler("rien", "x"));
    }
}
