package ca.local.footytv;

import android.app.Activity;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.GestureDetector;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.MotionEvent;
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
 * Footy TV, en mode câble : à l'ouverture, une vidéo joue déjà (le dernier match regardé
 * s'il est encore là, sinon le premier en direct), et on zappe. L'onglet Live, la liste
 * des matchs jouables, se pose PAR-DESSUS la vidéo, qui continue derrière.
 *
 * Tout tient dans cette activité, sans fragment ni bibliothèque d'interface. Le lecteur
 * n'existe que pendant que l'appli est au premier plan (onStart → onStop).
 *
 *                 Télécommande          Téléphone
 *   autre flux    ◀ ▶                   glisser à gauche / à droite
 *   autre match   ▲ ▼  (CH + / −)       glisser vers le haut / le bas
 *   ce qui joue   OK                    toucher
 *   Live          Retour                bouton « ☰ Live », ou Retour
 */
public class MainActivity extends Activity {

    /** La liste, régénérée par la vérification des lecteurs (scripts/verify_players.mjs). */
    static final String URL_LISTE = "https://raw.githubusercontent.com/ouellettejeanphilippe-source/footy/main/data/tv.json";
    static final String AGENT_PAR_DEFAUT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

    /** Un essai qui n'a rien montré au bout de ce délai passe au suivant. */
    static final long DELAI_DEMARRAGE_MS = 15_000;
    /** La liste se relit à ce rythme. */
    static final long RELECTURE_MS = 5 * 60_000;
    static final long BANDEAU_MS = 4_000;

    private final Handler h = new Handler(Looper.getMainLooper());

    private FrameLayout racine;
    private SurfaceView surface;
    private LinearLayout panneau;     // l'onglet Live
    private TextView entete;
    private ListView vue;
    private TextView bandeau;
    private TextView boutonLive;
    private TextView attente;

    private Liste liste;
    private ExoPlayer lecteur;
    private SharedPreferences prefs;
    private boolean tactile;

    private boolean enLecture;        // une vidéo est choisie (elle peut être derrière le Live)
    private boolean demarrageAuto = true;   // pas encore de vidéo depuis l'ouverture : on en lance une
    private int iMatch, iLien, iRef;
    private List<String> refs;
    private boolean aJoue;            // l'essai en cours a montré une image
    private boolean relance;          // l'essai en cours a déjà été relancé une fois après une coupure
    private int matchsEnEchec;        // matchs sautés d'affilée faute de flux qui répond

    private GestureDetector gestes;

    // ── Cycle de vie ─────────────────────────────────────────────────────────

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        prefs = getSharedPreferences("footytv", MODE_PRIVATE);
        tactile = getPackageManager().hasSystemFeature(PackageManager.FEATURE_TOUCHSCREEN);
        construireEcran();
        lireCache();
    }

    @Override
    protected void onStart() {
        super.onStart();
        creerLecteur();
        demarrageAuto = true;
        // Le cache d'abord : la vidéo démarre sans attendre le réseau.
        if (!demarrerSiPossible()) ouvrirLive();
        charger();
        h.postDelayed(relecture, RELECTURE_MS);
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
        // Marges de sécurité d'une télé (5 % de l'écran) : rien ne doit tomber hors cadre.
        pb.setMargins(dp(48), dp(27), dp(48), 0);
        racine.addView(bandeau, pb);

        boutonLive = new TextView(this);
        boutonLive.setText("☰  Live");
        boutonLive.setTextColor(Color.WHITE);
        boutonLive.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        boutonLive.setTypeface(Typeface.DEFAULT_BOLD);
        boutonLive.setBackgroundResource(R.drawable.bouton);
        boutonLive.setPadding(dp(20), dp(12), dp(20), dp(12));
        boutonLive.setVisibility(View.GONE);
        boutonLive.setOnClickListener(v -> ouvrirLive());
        FrameLayout.LayoutParams pl = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM | Gravity.END);
        pl.setMargins(0, 0, dp(32), dp(24));
        racine.addView(boutonLive, pl);

        // L'onglet Live : un panneau à gauche, par-dessus la vidéo qui continue de jouer.
        panneau = new LinearLayout(this);
        panneau.setOrientation(LinearLayout.VERTICAL);
        panneau.setBackgroundColor(0xF00B1220);
        panneau.setPadding(dp(32), dp(24), dp(24), dp(24));

        entete = new TextView(this);
        entete.setTextColor(0xFFE2E8F0);
        entete.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        entete.setTypeface(Typeface.DEFAULT_BOLD);
        entete.setPadding(dp(8), 0, dp(8), dp(12));
        panneau.addView(entete);

        vue = new ListView(this);
        vue.setSelector(R.drawable.ligne);
        vue.setDrawSelectorOnTop(false);
        vue.setDivider(null);
        vue.setItemsCanFocus(false);
        vue.setAdapter(adaptateur);
        vue.setOnItemClickListener((p, v, pos, id) -> { matchsEnEchec = 0; jouerMatch(pos); fermerLive(); });
        panneau.addView(vue, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        racine.addView(panneau, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT, Gravity.START));
        panneau.setVisibility(View.GONE);

        setContentView(racine);

        gestes = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override public boolean onDown(MotionEvent e) { return true; }
            @Override public boolean onSingleTapUp(MotionEvent e) { montrerBandeau(); return true; }
            @Override public boolean onFling(MotionEvent a, MotionEvent b, float vx, float vy) {
                if (a == null) return false;
                float dx = b.getX() - a.getX(), dy = b.getY() - a.getY();
                if (Math.max(Math.abs(dx), Math.abs(dy)) < dp(60)) return false;
                if (Math.abs(dx) > Math.abs(dy)) changerLien(dx < 0 ? +1 : -1);   // vers la gauche : suivant
                else zapperMatch(dy < 0 ? +1 : -1);                               // vers le haut : suivant
                return true;
            }
        });
    }

    /** Les gestes ne valent que sur la vidéo : la liste et le bouton gardent leurs touchers. */
    @Override
    public boolean dispatchTouchEvent(MotionEvent e) {
        if (panneau.getVisibility() != View.VISIBLE && enLecture && !surBouton(e)) {
            gestes.onTouchEvent(e);
            return true;
        }
        return super.dispatchTouchEvent(e);
    }

    private boolean surBouton(MotionEvent e) {
        if (boutonLive.getVisibility() != View.VISIBLE) return false;
        int[] p = new int[2];
        boutonLive.getLocationOnScreen(p);
        float x = e.getRawX(), y = e.getRawY();
        return x >= p[0] && x <= p[0] + boutonLive.getWidth() && y >= p[1] && y <= p[1] + boutonLive.getHeight();
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
            boolean courant = enLecture && i == iMatch;
            t.setText((courant ? "▶  " : "") + quand + "   ·   " + m.ligue + "\n" + m.titre() + "    (" + n + " flux)");
            t.setTypeface(courant ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
            return t;
        }
    };

    private TextView nouvelleLigne() {
        TextView t = new TextView(this);
        t.setTextColor(Color.WHITE);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 19);
        t.setLineSpacing(0, 1.15f);
        t.setPadding(dp(16), dp(12), dp(16), dp(12));
        return t;
    }

    private void majEntete(String etat) {
        int n = liste == null ? 0 : liste.matchs.size();
        String s = "Live  ·  " + (n == 0 ? "aucun match jouable pour l'instant" : n + (n > 1 ? " matchs jouables" : " match jouable"));
        entete.setText(etat == null ? s : s + "\n" + etat);
    }

    /** L'onglet Live. Avec une vidéo, il occupe la moitié gauche et elle joue à droite. */
    private void ouvrirLive() {
        FrameLayout.LayoutParams p = (FrameLayout.LayoutParams) panneau.getLayoutParams();
        int largeur = racine.getWidth();
        p.width = enLecture && largeur > 0 ? Math.max(dp(360), largeur * 45 / 100) : ViewGroup.LayoutParams.MATCH_PARENT;
        panneau.setLayoutParams(p);
        panneau.setVisibility(View.VISIBLE);
        bandeau.setVisibility(View.GONE);
        boutonLive.setVisibility(View.GONE);
        adaptateur.notifyDataSetChanged();
        majEntete(null);
        if (liste != null && iMatch < liste.matchs.size()) vue.setSelection(iMatch);
        vue.requestFocus();
    }

    private void fermerLive() {
        panneau.setVisibility(View.GONE);
        if (enLecture) montrerBandeau();
    }

    private boolean liveOuvert() { return panneau.getVisibility() == View.VISIBLE; }

    private final Runnable relecture = new Runnable() {
        @Override public void run() {
            charger();
            h.postDelayed(this, RELECTURE_MS);
        }
    };

    // ── Données ──────────────────────────────────────────────────────────────

    private File fichierCache() { return new File(getCacheDir(), "tv.json"); }

    /** Le dernier fichier reçu : la vidéo et la liste viennent tout de suite, même sans réseau. */
    private void lireCache() {
        try (InputStream in = new FileInputStream(fichierCache())) {
            liste = Liste.lire(new String(lireTout(in), StandardCharsets.UTF_8));
        } catch (Exception e) {
            liste = null;
        }
    }

    private void charger() {
        if (liveOuvert()) majEntete("mise à jour…");
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
            h.post(() -> recevoir(l, err));
        }, "liste").start();
    }

    private void recevoir(Liste nouvelle, String erreur) {
        if (nouvelle != null) {
            // Le match qu'on regarde garde sa place : les index de l'ancienne liste ne valent plus.
            String cle = enLecture && liste != null && iMatch < liste.matchs.size() ? Liste.cle(liste.matchs.get(iMatch)) : null;
            liste = nouvelle;
            if (cle != null) {
                int i = Liste.indexDe(liste, cle);
                if (i >= 0) iMatch = i;
                else arreter();   // le match a disparu (fini) : le flux en cours ne vaut plus rien
            }
        }
        if (!enLecture && !demarrerSiPossible() && !liveOuvert()) ouvrirLive();
        if (liveOuvert()) { adaptateur.notifyDataSetChanged(); majEntete(erreur); }
    }

    private static byte[] lireTout(InputStream in) throws java.io.IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] buf = new byte[16 * 1024];
        for (int n; (n = in.read(buf)) > 0; ) b.write(buf, 0, n);
        return b.toByteArray();
    }

    // ── Lecture ──────────────────────────────────────────────────────────────

    /** À l'ouverture, une vidéo sans rien demander : c'est le mode câble. */
    private boolean demarrerSiPossible() {
        if (!demarrageAuto || liste == null || liste.matchs.isEmpty()) return false;
        demarrageAuto = false;
        matchsEnEchec = 0;
        jouerMatch(Liste.matchDeDepart(liste, prefs.getString("dernier", "")));
        return true;
    }

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
                    matchsEnEchec = 0;
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
        relance = false;
        enLecture = true;
        demarrageAuto = false;
        prefs.edit().putString("dernier", Liste.cle(matchCourant())).apply();
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (liveOuvert()) adaptateur.notifyDataSetChanged();
        essayer();
    }

    private void zapperMatch(int pas) {
        matchsEnEchec = 0;
        jouerMatch(iMatch + pas);
    }

    private void arreter() {
        enLecture = false;
        h.removeCallbacks(chienDeGarde);
        if (lecteur != null) { lecteur.stop(); lecteur.clearMediaItems(); }
        attente.setVisibility(View.GONE);
        bandeau.setVisibility(View.GONE);
        boutonLive.setVisibility(View.GONE);
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
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
        if (!liveOuvert()) montrerBandeau();
        h.removeCallbacks(chienDeGarde);
        h.postDelayed(chienDeGarde, DELAI_DEMARRAGE_MS);
    }

    /** Un essai qui ne démarre pas dans les temps est un échec, même sans erreur. */
    private final Runnable chienDeGarde = () -> { if (enLecture && !aJoue) suivant(); };

    /**
     * L'essai suivant : autre Referer, puis autre lien. Quand plus aucun lien du match ne
     * répond, on zappe sur le match suivant, comme une chaîne muette. Après un tour
     * complet sans rien, on s'arrête sur l'onglet Live.
     */
    private void suivant() {
        relance = false;
        if (refs != null && iRef + 1 < refs.size()) { iRef++; essayer(); return; }
        if (iLien + 1 < matchCourant().liens.size()) { iLien++; iRef = 0; refs = null; essayer(); return; }
        String titre = matchCourant().titre();
        if (++matchsEnEchec < liste.matchs.size()) {
            jouerMatch(iMatch + 1);
            return;
        }
        arreter();
        ouvrirLive();
        majEntete("aucun flux ne répond (dernier essai : « " + titre + " »)");
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
        if (!enLecture) return;
        Liste.Match m = matchCourant();
        Liste.Lien l = m.liens.get(iLien);
        String aide = tactile
                ? "↔ autre flux   ↕ autre match"
                : "◀ ▶ autre flux   ▲ ▼ autre match   Retour : Live";
        bandeau.setText(m.titre() + "  ·  " + m.ligue
                + "\nFlux " + (iLien + 1) + "/" + m.liens.size() + "  ·  " + l.nom
                + (refs != null && refs.size() > 1 ? "  (essai " + (iRef + 1) + "/" + refs.size() + ")" : "")
                + "\n" + aide);
        bandeau.setVisibility(View.VISIBLE);
        if (tactile) boutonLive.setVisibility(View.VISIBLE);
        h.removeCallbacks(cacherBandeau);
        h.postDelayed(cacherBandeau, BANDEAU_MS);
    }

    private final Runnable cacherBandeau = () -> {
        bandeau.setVisibility(View.GONE);
        boutonLive.setVisibility(View.GONE);
    };

    // ── Télécommande ─────────────────────────────────────────────────────────

    @Override
    public boolean onKeyDown(int code, KeyEvent e) {
        if (code == KeyEvent.KEYCODE_BACK) {
            // Retour : la vidéo ouvre le Live, le Live revient à la vidéo, et seul un Live
            // sans vidéo quitte l'appli.
            if (liveOuvert() && enLecture) { fermerLive(); return true; }
            if (!liveOuvert()) { ouvrirLive(); return true; }
            return super.onKeyDown(code, e);
        }
        if (liveOuvert() || !enLecture) return super.onKeyDown(code, e);
        switch (code) {
            case KeyEvent.KEYCODE_DPAD_RIGHT:
            case KeyEvent.KEYCODE_MEDIA_NEXT:
                changerLien(+1); return true;
            case KeyEvent.KEYCODE_DPAD_LEFT:
            case KeyEvent.KEYCODE_MEDIA_PREVIOUS:
                changerLien(-1); return true;
            case KeyEvent.KEYCODE_DPAD_UP:
            case KeyEvent.KEYCODE_CHANNEL_UP:
                zapperMatch(-1); return true;
            case KeyEvent.KEYCODE_DPAD_DOWN:
            case KeyEvent.KEYCODE_CHANNEL_DOWN:
                zapperMatch(+1); return true;
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_INFO:
                montrerBandeau(); return true;
            case KeyEvent.KEYCODE_MENU:
            case KeyEvent.KEYCODE_GUIDE:
                ouvrirLive(); return true;
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                if (lecteur != null) lecteur.setPlayWhenReady(!lecteur.getPlayWhenReady());
                return true;
            default:
                return super.onKeyDown(code, e);
        }
    }
}
