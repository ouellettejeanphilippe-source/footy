package ca.local.footy;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
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
 * <p><b>La mémoire</b> (29 octobre 2026, diagnostic du Chromecast : 28 Mo de tas Java
 * sur 52, mémoire vive et swap de la télé pleins). Les 99 000 hôtes tenaient dans un
 * {@code HashSet<String>} : environ 10 Mo de tas, et autant de chaînes créées à la
 * lecture, à ramasser ensuite. On ne garde plus que l'empreinte 64 bits de chaque hôte
 * (FNV-1a), dans un tableau trié : 800 Ko, lus sans créer une seule chaîne, cherchés par
 * dichotomie. Le prix : un hôte innocent dont l'empreinte tomberait sur celle d'un hôte
 * bloqué — une chance sur 2⁶⁴ par étiquette, autant dire jamais ; aucun faux négatif.
 *
 * <p><b>Ce que cette liste ne fait pas.</b> Elle ne porte que ce qui s'exprime en un seul
 * nom d'hôte. Les filtres cosmétiques d'uBlock (masquer un emplacement vide), les règles
 * par type de ressource et celles qui dépendent de la page ne sont pas là : la WebView
 * n'offre qu'un point d'accroche, {@code shouldInterceptRequest}, où l'on ne voit qu'une
 * URL. Voir mobile/construire-blocage.mjs, qui fabrique la liste et dit ce qu'il écarte.
 */
public final class ListeDeBlocage {

    private static final long FNV_BASE = 0xcbf29ce484222325L;
    private static final long FNV_PREMIER = 0x100000001b3L;

    /** Les empreintes des hôtes, triées et sans doublon. */
    private final long[] empreintes;

    private ListeDeBlocage(long[] empreintes) {
        this.empreintes = empreintes;
    }

    /** Depuis des noms déjà en minuscules (les tests, et la liste vide de repli). */
    public ListeDeBlocage(Set<String> hotes) {
        long[] e = new long[hotes.size()];
        int n = 0;
        for (String h : hotes) {
            if (h == null || h.isEmpty()) continue;
            e[n++] = empreinte(h, 0);
        }
        this.empreintes = trier(e, n);
    }

    /**
     * Lit la liste : un hôte par ligne, les vides et les commentaires ignorés. Par blocs
     * de 64 Ko, l'empreinte se calcule au fil de la ligne : rien n'est alloué par hôte.
     */
    public static ListeDeBlocage depuis(InputStream flux) throws IOException {
        // 99 113 hôtes au 27 septembre 2026 ; la capacité évite de recopier le tableau.
        long[] e = new long[120000];
        int n = 0;
        try (InputStream in = flux) {
            byte[] tampon = new byte[1 << 16];
            long h = FNV_BASE;
            byte[] ligne = new byte[256]; // la ligne en cours, réutilisée d'une ligne à l'autre
            int longueur = 0;
            boolean commentaire = false, ascii = true, fini = false;
            while (!fini) {
                int lus = in.read(tampon);
                if (lus < 0) { lus = 1; tampon[0] = '\n'; fini = true; } // la dernière ligne, sans saut
                for (int i = 0; i < lus; i++) {
                    int b = tampon[i] & 0xff;
                    if (b == '\n') {
                        if (longueur > 0 && !commentaire) {
                            /* Rare (la liste est en punycode) : une ligne hors ASCII est
                               refaite en texte, pour que son empreinte soit celle
                               qu'estBloque calculera sur une chaîne. */
                            if (!ascii) h = empreinte(new String(ligne, 0, longueur, StandardCharsets.UTF_8), 0);
                            if (n == e.length) e = Arrays.copyOf(e, e.length * 2);
                            e[n++] = h;
                        }
                        h = FNV_BASE; longueur = 0; commentaire = false; ascii = true;
                        continue;
                    }
                    if (b == '\r') continue;
                    if (longueur == 0 && b == '#') commentaire = true;
                    if (commentaire) continue;
                    if (b >= 0x80) ascii = false;
                    if (longueur == ligne.length) ligne = Arrays.copyOf(ligne, ligne.length * 2);
                    ligne[longueur++] = (byte) b;
                    h ^= b;
                    h *= FNV_PREMIER;
                }
            }
        }
        return new ListeDeBlocage(trier(e, n));
    }

    private static long[] trier(long[] e, int n) {
        Arrays.sort(e, 0, n);
        int u = 0;
        for (int i = 0; i < n; i++) if (u == 0 || e[i] != e[u - 1]) e[u++] = e[i];
        return Arrays.copyOf(e, u);
    }

    /**
     * L'empreinte FNV-1a 64 bits de {@code s} depuis {@code debut}, sur ses octets UTF-8.
     * Pour l'ASCII — tous les hôtes réels —, l'octet est le caractère : aucune
     * conversion, aucune allocation.
     */
    static long empreinte(String s, int debut) {
        long h = FNV_BASE;
        for (int i = debut; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c >= 0x80) {
                byte[] octets = s.substring(debut).getBytes(StandardCharsets.UTF_8);
                h = FNV_BASE;
                for (byte b : octets) { h ^= (b & 0xff); h *= FNV_PREMIER; }
                return h;
            }
            h ^= c;
            h *= FNV_PREMIER;
        }
        return h;
    }

    public int taille() {
        return empreintes.length;
    }

    /**
     * L'hôte est-il bloqué, lui ou l'un de ses parents ?
     *
     * <p>{@code ads.doubleclick.net} tombe sur une règle pour {@code doubleclick.net}.
     * {@code monexemple.com} ne tombe PAS sur une règle pour {@code exemple.com}.
     */
    public boolean estBloque(String hote) {
        if (hote == null || hote.isEmpty() || empreintes.length == 0) return false;
        String h = hote.toLowerCase();
        if (h.startsWith("www.")) h = h.substring(4);

        int depuis = 0;
        while (true) {
            if (Arrays.binarySearch(empreintes, empreinte(h, depuis)) >= 0) return true;
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
