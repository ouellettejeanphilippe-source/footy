package ca.local.footy;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

/**
 * Le point d'entrée de l'application Android.
 *
 * <p>Tout ce qu'il ajoute à Capacitor, c'est le blocage des publicités : on remplace le
 * client de la WebView par le nôtre, qui HÉRITE de celui de Capacitor et ne fait que
 * refuser les requêtes vers les hôtes de publicité et de pistage. Tout le reste
 * redescend à {@code super}, donc le pont et le serveur local restent intacts.
 *
 * <p>Après {@code super.onCreate} et pas avant : c'est lui qui crée le pont et la
 * WebView.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle etat) {
        super.onCreate(etat);
        getBridge().setWebViewClient(new BloqueurWebViewClient(getBridge(), this));
    }
}
