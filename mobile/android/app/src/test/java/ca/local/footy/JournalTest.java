package ca.local.footy;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;

public class JournalTest {

    @Before public void vider() { Journal.vider(); }

    @Test public void lesHotesLesPlusBloquesEnTete() {
        for (int i = 0; i < 5; i++) Journal.requeteBloquee("regie.example");
        Journal.requeteBloquee("pistage.example");
        assertEquals("regie.example", Journal.plusBloques().get(0).getKey());
        assertEquals(Integer.valueOf(5), Journal.plusBloques().get(0).getValue());
    }

    @Test public void leJournalGardeSesDernieresLignes() {
        for (int i = 0; i < Journal.MAX_LIGNES + 10; i++) Journal.noter("ligne " + i);
        Journal.navigationRefusee("https://regie.example/x", true);
        Journal.etat("script", "posé");
        String s = Journal.instantane().toString();
        assertTrue(s.contains("navigation refusée (fenêtre)"));
        assertTrue(!s.contains("\"ligne 0\"") && !s.contains("  ligne 0\""));
        assertTrue(s.contains("\"script\":\"posé\""));
    }
}
