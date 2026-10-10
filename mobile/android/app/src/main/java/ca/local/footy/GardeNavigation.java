package ca.local.footy;

import java.net.URI;
import java.util.Locale;

/**
 * Qui a le droit d'emmener la fenêtre où ?
 *
 * <p>Sans {@code sandbox} sur les tuiles (exigence de l'utilisateur, certains lecteurs le
 * détectent), un lecteur peut faire {@code top.location = …} et emporter l'application
 * vers une régie. Sur ordinateur, la garde {@code beforeunload} de js/multiview.js retient
 * l'onglet. Dans l'APK, c'est pire : Capacitor confie toute adresse étrangère au système
 * (Bridge.launchIntent), qui ouvre la publicité dans le navigateur — et, sur un
 * Chromecast, l'application disparaît derrière.
 *
 * <p>La règle, sans Android pour être testée sur la JVM :
 * <ul>
 * <li>fenêtre principale : seulement l'application elle-même ({@code hoteAppli}), ou une
 * adresse {@code data:}/{@code blob:} ; tout le reste est refusé ;</li>
 * <li>cadre (un lecteur) : il navigue librement en http(s) — un lecteur change souvent de
 * page —, mais jamais vers un autre schéma : {@code intent://}, {@code market://}, une
 * application de jeu ou de pari, c'est toujours une régie.</li>
 * </ul>
 */
final class GardeNavigation {

    enum Decision { LAISSER, BLOQUER }

    private GardeNavigation() {}

    static Decision decider(String url, boolean fenetrePrincipale, String hoteAppli) {
        String schema = "", hote = "";
        try {
            URI u = new URI(url);
            schema = u.getScheme() == null ? "" : u.getScheme().toLowerCase(Locale.ROOT);
            hote = u.getHost() == null ? "" : u.getHost().toLowerCase(Locale.ROOT);
        } catch (Exception e) {
            // Une adresse illisible n'a rien à faire ici.
            return Decision.BLOQUER;
        }
        boolean web = schema.equals("http") || schema.equals("https");
        if (!fenetrePrincipale) return web || schema.equals("about") || schema.equals("data") || schema.equals("blob") ? Decision.LAISSER : Decision.BLOQUER;
        if (schema.equals("data") || schema.equals("blob")) return Decision.LAISSER;
        if (web && hoteAppli != null && hote.equals(hoteAppli.toLowerCase(Locale.ROOT))) return Decision.LAISSER;
        return Decision.BLOQUER;
    }
}
