package ca.local.footy;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;

/**
 * La liste des hôtes à bloquer, et la règle qui décide.
 *
 * <p>Cette classe ne connaît PAS Android : elle ne lit qu'un flux d'octets et répond à
 * une question sur un nom d'hôte. C'est délibéré — c'est ce qui permet de l'éprouver par
 * un test unitaire qui tourne sur la machine de développement, sans téléphone ni
 * émulateur. La colle Android vit à côté, dans {@link BloqueurWebViewClient}.
 *
 * <p><b>La règle des sous-domaines.</b> Dans la syntaxe d'uBlock, {@code ||exemple.com^}
 * bloque {@code exemple.com} ET tout ce qui finit par {@code .exemple.com}. C'est
 * essentiel : les régies ne servent presque jamais depuis le domaine nu, mais depuis
 * {@code pagead2.googlesyndication.com} ou {@code ads.exemple.com}. On remonte donc les
 * étiquettes une à une.
 *
 * <p>Et il faut remonter, pas seulement comparer un suffixe : {@code monexemple.com} se
 * termine par {@code exemple.com} sans être un sous-domaine. Comparer les chaînes
 * bloquerait des sites innocents.
 *
 * <p><b>Ce que cette liste ne fait pas.</b> Elle ne porte que ce qui s'exprime en un seul
 * nom d'hôte. Les filtres cosmétiques d'uBlock (masquer un emplacement vide), les règles
 * par type de ressource et celles qui dépendent de la page ne sont pas là : la WebView
 * n'offre qu'un point d'accroche, {@code shouldInterceptRequest}, où l'on ne voit qu'une
 * URL. Voir mobile/construire-blocage.mjs, qui fabrique la liste et dit ce qu'il écarte.
 */
public final class ListeDeBlocage {

    private final Set<String> hotes;

    public ListeDeBlocage(Set<String> hotes) {
        this.hotes = hotes;
    }

    /** Lit la liste : un hôte par ligne, les vides et les commentaires ignorés. */
    public static ListeDeBlocage depuis(InputStream flux) throws IOException {
        // 99 113 hôtes au 27 septembre 2026 ; la capacité évite des centaines de
        // redimensionnements pendant le chargement.
        Set<String> lus = new HashSet<>(160000);
        try (BufferedReader r = new BufferedReader(
                new InputStreamReader(flux, StandardCharsets.UTF_8), 1 << 16)) {
            String ligne;
            while ((ligne = r.readLine()) != null) {
                if (ligne.isEmpty() || ligne.charAt(0) == '#') continue;
                lus.add(ligne);
            }
        }
        return new ListeDeBlocage(lus);
    }

    public int taille() {
        return hotes.size();
    }

    /**
     * L'hôte est-il bloqué, lui ou l'un de ses parents ?
     *
     * <p>{@code ads.doubleclick.net} tombe sur une règle pour {@code doubleclick.net}.
     * {@code monexemple.com} ne tombe PAS sur une règle pour {@code exemple.com}.
     */
    public boolean estBloque(String hote) {
        if (hote == null || hote.isEmpty()) return false;
        String h = hote.toLowerCase();
        if (h.startsWith("www.")) h = h.substring(4);

        int depuis = 0;
        while (true) {
            if (hotes.contains(h.substring(depuis))) return true;
            int point = h.indexOf('.', depuis);
            if (point < 0) return false;
            depuis = point + 1;
            // Un suffixe d'un seul niveau ("com") n'est jamais une règle utile, et le
            // chercher ferait bloquer tout un TLD si une liste en contenait un par erreur.
            if (h.indexOf('.', depuis) < 0) return false;
        }
    }

    /**
     * L'hôte d'une URL, sans le port ni l'identifiant. Rend null si l'adresse est
     * illisible.
     *
     * <p>L'ordre des trois étapes compte, et une première version s'y est trompée :
     * il faut d'abord délimiter l'AUTORITÉ (jusqu'au premier {@code / ? #}), puis
     * retirer l'identifiant s'il y en a un, et seulement ensuite chercher le port.
     * Chercher le {@code :} en premier s'arrêtait sur celui du mot de passe et rendait
     * « user » comme nom d'hôte pour {@code https://user:mdp@exemple.com/x}.
     */
    public static String hoteDe(String url) {
        if (url == null) return null;
        int debut = url.indexOf("://");
        if (debut < 0) return null;
        debut += 3;

        int finAutorite = url.length();
        for (int i = debut; i < url.length(); i++) {
            char c = url.charAt(i);
            if (c == '/' || c == '?' || c == '#') { finAutorite = i; break; }
        }
        if (finAutorite <= debut) return null;

        int arobase = url.lastIndexOf('@', finAutorite - 1);
        if (arobase >= debut) debut = arobase + 1;

        int fin = finAutorite;
        for (int i = debut; i < finAutorite; i++) {
            if (url.charAt(i) == ':') { fin = i; break; }
        }
        if (fin <= debut) return null;
        return url.substring(debut, fin).toLowerCase();
    }
}
