package ca.local.footy;

/**
 * Le décodeur vidéo que le lecteur natif a pris : matériel ou logiciel (29 octobre 2026,
 * « bien meilleure performance sur CCGTV »).
 *
 * <p>Sur les puces Amlogic des Chromecast, quand le décodeur matériel refuse de démarrer,
 * Media3 passe au suivant de la liste, qui peut être un décodeur logiciel : la vidéo saccade
 * et le compte des images perdues ne le montre pas toujours (androidx/media#3457,
 * NuvioTV#3968). Le nom du décodeur, lui, ne ment pas : {@link LecteurActivity} l'écrit au
 * journal (Plus → Logs). Mêmes règles que {@code MediaCodecUtil.isSoftwareOnly} de Media3,
 * en Java pur pour être testées sur la JVM.
 */
final class Decodeur {
    private Decodeur() {}

    static boolean estLogiciel(String nom) {
        if (nom == null) return false;
        String n = nom.toLowerCase(java.util.Locale.ROOT);
        if (n.startsWith("omx.google.") || n.startsWith("omx.ffmpeg.") || n.startsWith("c2.android.") || n.startsWith("c2.google.")) return true;
        if (n.startsWith("omx.sec.") && n.contains(".sw.")) return true;
        if (n.equals("omx.qcom.video.decoder.hevcswvdec")) return true;
        // Un décodeur qui n'est ni OMX ni Codec2 vient d'une bibliothèque embarquée : logiciel.
        return !n.startsWith("omx.") && !n.startsWith("c2.");
    }

    /** La ligne du journal : « décodeur c2.amlogic.avc.decoder (matériel) ». */
    static String ligne(String nom) {
        return "lecteur natif : décodeur " + nom + (estLogiciel(nom)
                ? " (LOGICIEL : la puce ne décode pas ce flux elle-même, la vidéo coûtera cher et peut saccader)"
                : " (matériel)");
    }
}
