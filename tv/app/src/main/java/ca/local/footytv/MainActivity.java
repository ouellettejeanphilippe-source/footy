package ca.local.footytv;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.SurfaceView;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.BaseAdapter;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;

import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.VideoSize;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.hls.HlsMediaSource;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Footy TV : la liste des matchs jouables, puis la vidéo en plein écran.
 *
 * Tout tient dans cette activité, sans fragment ni bibliothèque d'interface : une liste,
 * une surface vidéo et deux lignes de texte. Le lecteur n'existe que pendant que l'appli
 * est au premier plan (onStart → onStop) : en arrière-plan, elle ne garde rien en mémoire
 * et ne consomme rien.
 *
 * Télécommande, pendant la vidéo :
 *   ◀ ▶          flux précédent / suivant du même match
 *   ▲ ▼ (CH +/-) match précédent / suivant
 *   OK           ce qui joue (bandeau)
 *   Retour       la liste
 */
public class MainActivity extends Activity {

    /** La liste, régénérée par la vérification des lecteurs (scripts/verify_players.mjs). */
    static final String URL_LISTE = "https://raw.githubusercontent.com/ouellettejeanphilippe-source/footy/main/data/tv.json";
    static final String AGENT_PAR_DEFAUT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

    /** Un essai qui n'a rien montré au bout de ce délai passe au suivant. */
    static final long DELAI_DEMARRAGE_MS = 15_000;
    /** La liste se relit à ce rythme tant qu'elle est à l'écran. */
    static final long RELECTURE_MS = 5 * 60_000;
    static final long BANDEAU_MS = 4_000;

    private final Handler h = new Handler(Looper.getMainLooper());

    private FrameLayout racine;
    private SurfaceView surface;
    private LinearLayout ecranListe;
    private TextView entete;
    private ListView vue;
    private TextView bandeau;
    private TextView attente;

    private Liste liste;
    private ExoPlayer lecteur;

    private boolean enLecture;
    private int iMatch, iLien, iRef;
    private List<String> refs;
    private boolean aJoue;      // l'essai en cours a montré une image
    private boolean relance;    // l'essai en cours a déjà été relancé une fois après une coupure

    // ── Cycle de vie ─────────────────────────────────────────────────────────

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        construireEcran();
        lireCache();
    }

    @Override
    protected void onStart() {
        super.onStart();
        creerLecteur();
        montrerListe();
        charger();
    }

    @Override
    protected void onStop() {
        super.onStop();
        h.removeCallbacksAndMessages(null);
        enLecture = false;
        if (lecteur != null) { lecteur.release(); lecteur = null; }
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    // ── Écran ────────────────────────────────────────────────────────────────

    private int dp(float v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }

    private void construireEcran() {
        racine = new FrameLayout(this);
        racine.setBackgroundColor(Color.BLACK);

        surface = new SurfaceView(this);
        racine.addView(surface, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT, Gravity.CENTER));
        surface.setVisibility(View.GONE);

        ecranListe = new LinearLayout(this);
        ecranListe.setOrientation(LinearLayout.VERTICAL);
        ecranListe.setBackgroundColor(0xFF0B1220);
        // Marges de sécurité d'une télé (5 % de l'écran) : rien ne doit tomber hors cadre.
        ecranListe.setPadding(dp(48), dp(27), dp(48), dp(27));

        entete = new TextView(this);
        entete.setTextColor(0xFFE2E8F0);
        entete.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        entete.setTypeface(Typeface.DEFAULT_BOLD);
        entete.setPadding(dp(8), 0, dp(8), dp(12));
        ecranListe.addView(entete);

        vue = new ListView(this);
        vue.setSelector(R.drawable.ligne);
        vue.setDrawSelectorOnTop(false);
        vue.setDivider(null);
        vue.setItemsCanFocus(false);
        vue.setOnItemClickListener((p, v, pos, id) -> jouerMatch(pos));
        ecranListe.addView(vue, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        racine.addView(ecranListe, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        attente = new TextView(this);
        attente.setTextColor(Color.WHITE);
        attente.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        attente.setGravity(Gravity.CENTER);
        attente.setVisibility(View.GONE);
        racine.addView(attente, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER));

        bandeau = new TextView(this);
        bandeau.setTextColor(Color.WHITE);
        bandeau.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        bandeau.setBackgroundColor(0xCC000000);
        bandeau.setPadding(dp(16), dp(10), dp(16), dp(10));
        bandeau.setVisibility(View.GONE);
        FrameLayout.LayoutParams pb = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP | Gravity.START);
        pb.setMargins(dp(48), dp(27), dp(48), 0);
        racine.addView(bandeau, pb);

        setContentView(racine);
    }

    private final BaseAdapter adaptateur = new BaseAdapter() {
        @Override public int getCount() { return liste == null ? 0 : liste.matchs.size(); }
        @Override public Object getItem(int i) { return liste.matchs.get(i); }
        @Override public long getItemId(int i) { return i; }
        @Override public View getView(int i, View recycle, ViewGroup parent) {
            TextView t = recycle instanceof TextView ? (TextView) recycle : nouvelleLigne();
            Liste.Match m = liste.matchs.get(i);
            String quand = m.enDirect() ? "● EN DIRECT" : Liste.heureLocale(m, ZoneId.systemDefault());
            int n = m.liens.size();
            t.setText(quand + "   ·   " + m.ligue + "\n" + m.titre() + "    (" + n + (n > 1 ? " flux)" : " flux)"));
            return t;
        }
    };

    private TextView nouvelleLigne() {
        TextView t = new TextView(this);
        t.setTextColor(Color.WHITE);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        t.setLineSpacing(0, 1.15f);
        t.setPadding(dp(16), dp(12), dp(16), dp(12));
        return t;
    }

    private void majEntete(String etat) {
        int n = liste == null ? 0 : liste.matchs.size();
        String s = "Footy TV  ·  " + (n == 0 ? "aucun match jouable pour l'instant" : n + (n > 1 ? " matchs jouables" : " match jouable"));
        entete.setText(etat == null ? s : s + "  ·  " + etat);
    }

    private void montrerListe() {
        enLecture = false;
        h.removeCallbacks(chienDeGarde);
        if (lecteur != null) { lecteur.stop(); lecteur.clearMediaItems(); }
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        surface.setVisibility(View.GONE);
        bandeau.setVisibility(View.GONE);
        attente.setVisibility(View.GONE);
        ecranListe.setVisibility(View.VISIBLE);
        if (vue.getAdapter() == null) vue.setAdapter(adaptateur);
        adaptateur.notifyDataSetChanged();
        majEntete(null);
        if (liste != null && iMatch < liste.matchs.size()) vue.setSelection(iMatch);
        vue.requestFocus();
        h.removeCallbacks(relecture);
        h.postDelayed(relecture, RELECTURE_MS);
    }

    private final Runnable relecture = new Runnable() {
        @Override public void run() {
            if (!enLecture) charger();
            h.postDelayed(this, RELECTURE_MS);
        }
    };

    // ── Données ──────────────────────────────────────────────────────────────

    private File fichierCache() { return new File(getCacheDir(), "tv.json"); }

    /** Le dernier fichier reçu : la liste s'affiche tout de suite, même sans réseau. */
    private void lireCache() {
        try (InputStream in = new FileInputStream(fichierCache())) {
            liste = Liste.lire(new String(lireTout(in), StandardCharsets.UTF_8));
        } catch (Exception e) {
            liste = null;
        }
    }

    private void charger() {
        majEntete("mise à jour…");
        new Thread(() -> {
            String erreur = null;
            Liste nouvelle = null;
            try {
                // Une adresse qui change chaque minute : le cache de raw.githubusercontent.com
                // garderait sinon une version de cinq minutes.
                HttpURLConnection c = (HttpURLConnection) new URL(URL_LISTE + "?t=" + (System.currentTimeMillis() / 60_000)).openConnection();
                c.setConnectTimeout(10_000);
                c.setReadTimeout(15_000);
                try (InputStream in = c.getInputStream()) {
                    byte[] corps = lireTout(in);
                    nouvelle = Liste.lire(new String(corps, StandardCharsets.UTF_8));
                    try (FileOutputStream out = new FileOutputStream(fichierCache())) { out.write(corps); }
                } finally {
                    c.disconnect();
                }
            } catch (Exception e) {
                erreur = "liste injoignable (" + e.getClass().getSimpleName() + ")";
            }
            final Liste l = nouvelle;
            final String err = erreur;
            h.post(() -> {
                if (l != null) liste = l;
                if (!enLecture) {
                    adaptateur.notifyDataSetChanged();
                    majEntete(err);
                }
            });
        }, "liste").start();
    }

    private static byte[] lireTout(InputStream in) throws java.io.IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] buf = new byte[16 * 1024];
        for (int n; (n = in.read(buf)) > 0; ) b.write(buf, 0, n);
        return b.toByteArray();
    }

    // ── Lecture ──────────────────────────────────────────────────────────────

    private void creerLecteur() {
        if (lecteur != null) return;
        // Des tampons courts : c'est du direct, et un Chromecast n'a que 2 Go de mémoire.
        DefaultLoadControl tampons = new DefaultLoadControl.Builder()
                .setBufferDurationsMs(8_000, 24_000, 1_500, 3_000)
                .setTargetBufferBytes(24 * 1024 * 1024)
                .setPrioritizeTimeOverSizeThresholds(false)
                .build();
        lecteur = new ExoPlayer.Builder(this).setLoadControl(tampons).build();
        lecteur.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MOVIE).build(), true);
        lecteur.setVideoSurfaceView(surface);
        lecteur.addListener(new Player.Listener() {
            @Override public void onPlaybackStateChanged(int etat) {
                if (etat == Player.STATE_READY && enLecture) {
                    aJoue = true;
                    attente.setVisibility(View.GONE);
                    h.removeCallbacks(chienDeGarde);
                }
            }
            @Override public void onPlayerError(PlaybackException e) {
                if (!enLecture) return;
                // Le direct a filé devant nous (pause, coupure) : on revient au bord, même flux.
                if (e.errorCode == PlaybackException.ERROR_CODE_BEHIND_LIVE_WINDOW) {
                    lecteur.seekToDefaultPosition();
                    lecteur.prepare();
                    return;
                }
                // Un flux qui jouait et qui coupe mérite une relance avant d'être abandonné.
                if (aJoue && !relance) {
                    relance = true;
                    essayer();
                    return;
                }
                suivant();
            }
            @Override public void onVideoSizeChanged(VideoSize v) { ajusterSurface(v); }
        });
    }

    /** L'image entière, sans déformation : bandes noires si le flux n'est pas en 16:9. */
    private void ajusterSurface(VideoSize v) {
        if (v.width == 0 || v.height == 0) return;
        float ratio = v.width * v.pixelWidthHeightRatio / v.height;
        int lw = racine.getWidth(), lh = racine.getHeight();
        if (lw == 0 || lh == 0) return;
        int w = lw, hh = Math.round(lw / ratio);
        if (hh > lh) { hh = lh; w = Math.round(lh * ratio); }
        FrameLayout.LayoutParams p = (FrameLayout.LayoutParams) surface.getLayoutParams();
        p.width = w; p.height = hh; p.gravity = Gravity.CENTER;
        surface.setLayoutParams(p);
    }

    private void jouerMatch(int i) {
        if (liste == null || liste.matchs.isEmpty()) return;
        int n = liste.matchs.size();
        iMatch = ((i % n) + n) % n;
        iLien = 0;
        iRef = 0;
        refs = null;
        enLecture = true;
        h.removeCallbacks(relecture);
        ecranListe.setVisibility(View.GONE);
        surface.setVisibility(View.VISIBLE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        essayer();
    }

    private Liste.Match matchCourant() { return liste.matchs.get(iMatch); }

    /** Joue le lien iLien du match courant, avec le Referer iRef. */
    private void essayer() {
        if (lecteur == null) creerLecteur();
        Liste.Lien l = matchCourant().liens.get(iLien);
        if (refs == null) refs = Liste.referers(l);
        String ref = refs.get(iRef);

        Map<String, String> entetes = new HashMap<>();
        if (!ref.isEmpty()) {
            entetes.put("Referer", ref);
            String o = Liste.origine(ref);
            if (!o.isEmpty()) entetes.put("Origin", o);
        }
        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
                .setUserAgent(liste.agent.isEmpty() ? AGENT_PAR_DEFAUT : liste.agent)
                .setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(8_000)
                .setReadTimeoutMs(8_000)
                .setDefaultRequestProperties(entetes);
        lecteur.setMediaSource(new HlsMediaSource.Factory(http)
                .setAllowChunklessPreparation(true)
                .createMediaSource(MediaItem.fromUri(l.media)));
        lecteur.prepare();
        lecteur.setPlayWhenReady(true);

        aJoue = false;
        attente.setText("Chargement…");
        attente.setVisibility(View.VISIBLE);
        montrerBandeau();
        h.removeCallbacks(chienDeGarde);
        h.postDelayed(chienDeGarde, DELAI_DEMARRAGE_MS);
    }

    /** Un essai qui ne démarre pas dans les temps est un échec, même sans erreur. */
    private final Runnable chienDeGarde = () -> { if (enLecture && !aJoue) suivant(); };

    /** L'essai suivant : autre Referer, puis autre lien ; au bout, retour à la liste. */
    private void suivant() {
        relance = false;
        if (refs != null && iRef + 1 < refs.size()) { iRef++; essayer(); return; }
        if (iLien + 1 < matchCourant().liens.size()) { iLien++; iRef = 0; refs = null; essayer(); return; }
        montrerListe();
        majEntete("aucun flux de « " + matchCourant().titre() + " » ne répond");
        charger();
    }

    private void changerLien(int pas) {
        int n = matchCourant().liens.size();
        iLien = ((iLien + pas) % n + n) % n;
        iRef = 0;
        refs = null;
        relance = false;
        essayer();
    }

    private void montrerBandeau() {
        Liste.Match m = matchCourant();
        Liste.Lien l = m.liens.get(iLien);
        bandeau.setText(m.titre() + "  ·  " + m.ligue
                + "\nFlux " + (iLien + 1) + "/" + m.liens.size() + "  ·  " + l.nom
                + (refs != null && refs.size() > 1 ? "  (essai " + (iRef + 1) + "/" + refs.size() + ")" : "")
                + "\n◀ ▶ autre flux   ▲ ▼ autre match");
        bandeau.setVisibility(View.VISIBLE);
        h.removeCallbacks(cacherBandeau);
        h.postDelayed(cacherBandeau, BANDEAU_MS);
    }

    private final Runnable cacherBandeau = () -> bandeau.setVisibility(View.GONE);

    // ── Télécommande ─────────────────────────────────────────────────────────

    @Override
    public boolean onKeyDown(int code, KeyEvent e) {
        if (!enLecture) return super.onKeyDown(code, e);
        switch (code) {
            case KeyEvent.KEYCODE_DPAD_RIGHT:
            case KeyEvent.KEYCODE_MEDIA_NEXT:
                changerLien(+1); return true;
            case KeyEvent.KEYCODE_DPAD_LEFT:
            case KeyEvent.KEYCODE_MEDIA_PREVIOUS:
                changerLien(-1); return true;
            case KeyEvent.KEYCODE_DPAD_UP:
            case KeyEvent.KEYCODE_CHANNEL_UP:
                jouerMatch(iMatch - 1); return true;
            case KeyEvent.KEYCODE_DPAD_DOWN:
            case KeyEvent.KEYCODE_CHANNEL_DOWN:
                jouerMatch(iMatch + 1); return true;
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_INFO:
                montrerBandeau(); return true;
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                if (lecteur != null) lecteur.setPlayWhenReady(!lecteur.getPlayWhenReady());
                return true;
            case KeyEvent.KEYCODE_BACK:
                montrerListe(); return true;
            default:
                return super.onKeyDown(code, e);
        }
    }
}
