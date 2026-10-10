package ca.local.footy;

import android.content.Intent;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;

/**
 * Le pont entre l'application (js/tele.js, poserDirectNatif dans js/multiview.js) et le
 * lecteur natif ({@link LecteurActivity}).
 *
 * <p>{@code jouer} ouvre le lecteur, ou lui donne un autre flux s'il est déjà ouvert ;
 * {@code fermer} le referme (la tuile repart sur une page). Le lecteur répond par
 * l'événement {@code evenement} : {@code joue}, {@code echec}, {@code chaine} et
 * {@code source} (la télécommande), {@code ferme}. C'est l'application qui choisit le
 * flux suivant : le lecteur natif ne fait que jouer.
 */
@CapacitorPlugin(name = "LecteurNatif")
public class LecteurNatifPlugin extends Plugin {

    private static LecteurNatifPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    @PluginMethod
    public void jouer(PluginCall call) {
        String media = call.getString("media", "");
        if (media == null || media.isEmpty()) { call.reject("aucun flux"); return; }
        ArrayList<String> referers = new ArrayList<>();
        JSArray r = call.getArray("referers");
        for (int i = 0; r != null && i < r.length(); i++) {
            String v = r.optString(i, null);
            if (v != null) referers.add(v);
        }
        if (referers.isEmpty()) referers.add("");
        Intent intent = new Intent(getContext(), LecteurActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra(LecteurActivity.EXTRA_MEDIA, media)
                .putStringArrayListExtra(LecteurActivity.EXTRA_REFERERS, referers)
                .putExtra(LecteurActivity.EXTRA_TITRE, call.getString("titre", ""))
                .putExtra(LecteurActivity.EXTRA_SOURCE, call.getString("source", ""));
        getActivity().startActivity(intent);
        call.resolve();
    }

    /** Le journal de l'appareil (Journal), pour Plus → Logs. */
    @PluginMethod
    public void diagnostic(PluginCall call) {
        try {
            call.resolve(new JSObject(Journal.instantane().toString()));
        } catch (org.json.JSONException e) {
            call.reject("journal illisible");
        }
    }

    @PluginMethod
    public void fermer(PluginCall call) {
        LecteurActivity.fermerSiOuvert();
        call.resolve();
    }

    /** Un événement du lecteur vers l'application. Sans application à l'écoute, il se perd. */
    static void signaler(String type, Integer sens, String raison) {
        LecteurNatifPlugin p = instance;
        if (p == null) return;
        JSObject o = new JSObject();
        o.put("type", type);
        if (sens != null) o.put("sens", sens);
        if (raison != null) o.put("raison", raison);
        p.notifyListeners("evenement", o);
    }
}
