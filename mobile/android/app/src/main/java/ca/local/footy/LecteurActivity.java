package ca.local.footy;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
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
import android.widget.FrameLayout;
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

import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Le lecteur natif : un manifeste HLS en plein écran, par ExoPlayer, sans page.
 *
 * <p>« Même un navigateur comme Vivaldi est hyper lent sur Chromecast » (10 octobre 2026).
 * Ici, pas de WebView, pas de hls.js : le décodage est matériel, et le {@code Referer}
 * que la plupart des CDN exigent peut être posé, ce qu'aucun navigateur ne sait faire.
 * Les {@code Referer} viennent de l'application, dans l'ordre où les essayer
 * ({@code referersPour}, js/tele.js).
 *
 * <p>La télécommande ne décide rien ici : ▲▼ et ◀▶ sont renvoyées à l'application, qui
 * zappe ou change de source comme en mode câble, et rappelle {@code jouer} avec le flux
 * suivant ({@link #onNewIntent}) — ou {@code fermer} s'il n'est qu'une page.
 */
public class LecteurActivity extends Activity {

    static final String EXTRA_MEDIA = "media";
    static final String EXTRA_REFERERS = "referers";
    static final String EXTRA_TITRE = "titre";
    static final String EXTRA_SOURCE = "source";

    static final String AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
    /** Un essai qui n'a rien montré au bout de ce délai passe au Referer suivant. */
    static final long DELAI_DEMARRAGE_MS = 12_000;
    static final long BANDEAU_MS = 4_000;

    private static WeakReference<LecteurActivity> ouverte = new WeakReference<>(null);

    static void fermerSiOuvert() {
        LecteurActivity a = ouverte.get();
        if (a != null) a.runOnUiThread(() -> { a.fermeParAppli = true; a.finish(); });
    }

    private final Handler h = new Handler(Looper.getMainLooper());
    private FrameLayout racine;
    private SurfaceView surface;
    private TextView bandeau, attente;
    private ExoPlayer lecteur;
    private GestureDetector gestes;

    private String media = "", titre = "", source = "";
    private List<String> referers = new ArrayList<>();
    private int iRef;
    private boolean aJoue, relance, fermeParAppli;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        ouverte = new WeakReference<>(this);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);
        construireEcran();
        lire(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        lire(intent);
        if (lecteur != null) essayer();
    }

    @Override
    protected void onStart() {
        super.onStart();
        creerLecteur();
        essayer();
    }

    /** En arrière-plan, rien ne reste : ni lecteur, ni tampon, ni réseau. */
    @Override
    protected void onStop() {
        super.onStop();
        h.removeCallbacksAndMessages(null);
        if (lecteur != null) { lecteur.release(); lecteur = null; }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (ouverte.get() == this) ouverte = new WeakReference<>(null);
        if (!fermeParAppli) LecteurNatifPlugin.signaler("ferme", null, null);
    }

    private void lire(Intent i) {
        media = str(i.getStringExtra(EXTRA_MEDIA));
        titre = str(i.getStringExtra(EXTRA_TITRE));
        source = str(i.getStringExtra(EXTRA_SOURCE));
        ArrayList<String> r = i.getStringArrayListExtra(EXTRA_REFERERS);
        referers = r == null || r.isEmpty() ? java.util.Collections.singletonList("") : r;
        iRef = 0;
        relance = false;
    }

    private static String str(String s) { return s == null ? "" : s; }

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
        racine.addView(attente, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER));

        bandeau = new TextView(this);
        bandeau.setTextColor(Color.WHITE);
        bandeau.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        bandeau.setBackgroundColor(0xCC000000);
        bandeau.setPadding(dp(16), dp(10), dp(16), dp(10));
        bandeau.setVisibility(View.GONE);
        FrameLayout.LayoutParams pb = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP | Gravity.START);
        // Marges de sécurité d'une télé (5 % de l'écran).
        pb.setMargins(dp(48), dp(27), dp(48), 0);
        racine.addView(bandeau, pb);
        setContentView(racine);

        gestes = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override public boolean onDown(MotionEvent e) { return true; }
            @Override public boolean onSingleTapUp(MotionEvent e) { montrerBandeau(); return true; }
            @Override public boolean onFling(MotionEvent a, MotionEvent b, float vx, float vy) {
                if (a == null) return false;
                float dx = b.getX() - a.getX(), dy = b.getY() - a.getY();
                if (Math.max(Math.abs(dx), Math.abs(dy)) < dp(60)) return false;
                // Les mêmes sens que le mode câble de l'application (js/cable.js).
                if (Math.abs(dx) > Math.abs(dy)) LecteurNatifPlugin.signaler("source", dx < 0 ? 1 : -1, null);
                else LecteurNatifPlugin.signaler("chaine", dy < 0 ? 1 : -1, null);
                return true;
            }
        });
    }

    @Override
    public boolean onTouchEvent(MotionEvent e) {
        return gestes.onTouchEvent(e) || super.onTouchEvent(e);
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
                if (etat == Player.STATE_READY && !aJoue) {
                    aJoue = true;
                    attente.setVisibility(View.GONE);
                    h.removeCallbacks(chienDeGarde);
                    LecteurNatifPlugin.signaler("joue", null, null);
                }
            }
            @Override public void onPlayerError(PlaybackException e) {
                if (e.errorCode == PlaybackException.ERROR_CODE_BEHIND_LIVE_WINDOW) {
                    lecteur.seekToDefaultPosition();
                    lecteur.prepare();
                    return;
                }
                // Un flux qui jouait et qui coupe mérite une relance avant d'être abandonné.
                if (aJoue && !relance) { relance = true; essayer(); return; }
                suivant(e.getErrorCodeName());
            }
            @Override public void onVideoSizeChanged(VideoSize v) { ajusterSurface(v); }
        });
    }

    /** L'image entière, sans déformation. */
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

    static String origine(String page) {
        try {
            java.net.URI u = new java.net.URI(page);
            if (u.getScheme() == null || u.getHost() == null) return "";
            return u.getScheme() + "://" + u.getHost() + (u.getPort() >= 0 ? ":" + u.getPort() : "");
        } catch (Exception e) {
            return "";
        }
    }

    private void essayer() {
        if (lecteur == null || media.isEmpty()) return;
        String ref = referers.get(iRef);
        Map<String, String> entetes = new HashMap<>();
        if (!ref.isEmpty()) {
            entetes.put("Referer", ref);
            String o = origine(ref);
            if (!o.isEmpty()) entetes.put("Origin", o);
        }
        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
                .setUserAgent(AGENT)
                .setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(8_000)
                .setReadTimeoutMs(8_000)
                .setDefaultRequestProperties(entetes);
        lecteur.setMediaSource(new HlsMediaSource.Factory(http)
                .setAllowChunklessPreparation(true)
                .createMediaSource(MediaItem.fromUri(media)));
        lecteur.prepare();
        lecteur.setPlayWhenReady(true);
        aJoue = false;
        attente.setText("Chargement…");
        attente.setVisibility(View.VISIBLE);
        montrerBandeau();
        h.removeCallbacks(chienDeGarde);
        h.postDelayed(chienDeGarde, DELAI_DEMARRAGE_MS);
    }

    private final Runnable chienDeGarde = () -> { if (!aJoue) suivant("rien en " + DELAI_DEMARRAGE_MS / 1000 + " s"); };

    /** Le Referer suivant ; au bout, l'application reprend la main (retour à la page). */
    private void suivant(String raison) {
        relance = false;
        if (iRef + 1 < referers.size()) { iRef++; essayer(); return; }
        h.removeCallbacks(chienDeGarde);
        fermeParAppli = true;
        LecteurNatifPlugin.signaler("echec", null, raison);
        finish();
    }

    private void montrerBandeau() {
        boolean tactile = getPackageManager().hasSystemFeature(android.content.pm.PackageManager.FEATURE_TOUCHSCREEN);
        bandeau.setText((titre.isEmpty() ? "" : titre + "\n") + source
                + (referers.size() > 1 ? "  (essai " + (iRef + 1) + "/" + referers.size() + ")" : "")
                + "\n" + (tactile ? "↔ autre source   ↕ autre match" : "◀ ▶ autre source   ▲ ▼ autre match   Retour : l'application"));
        bandeau.setVisibility(View.VISIBLE);
        h.removeCallbacks(cacherBandeau);
        h.postDelayed(cacherBandeau, BANDEAU_MS);
    }

    private final Runnable cacherBandeau = () -> bandeau.setVisibility(View.GONE);

    @Override
    public boolean onKeyDown(int code, KeyEvent e) {
        switch (code) {
            case KeyEvent.KEYCODE_DPAD_RIGHT:
            case KeyEvent.KEYCODE_MEDIA_NEXT:
                LecteurNatifPlugin.signaler("source", 1, null); return true;
            case KeyEvent.KEYCODE_DPAD_LEFT:
            case KeyEvent.KEYCODE_MEDIA_PREVIOUS:
                LecteurNatifPlugin.signaler("source", -1, null); return true;
            // ▲ (CH +) : la chaîne suivante, comme ↑ dans le mode câble (actionDuGeste, js/cable.js).
            case KeyEvent.KEYCODE_DPAD_UP:
            case KeyEvent.KEYCODE_CHANNEL_UP:
                LecteurNatifPlugin.signaler("chaine", 1, null); return true;
            case KeyEvent.KEYCODE_DPAD_DOWN:
            case KeyEvent.KEYCODE_CHANNEL_DOWN:
                LecteurNatifPlugin.signaler("chaine", -1, null); return true;
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_INFO:
                montrerBandeau(); return true;
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                if (lecteur != null) lecteur.setPlayWhenReady(!lecteur.getPlayWhenReady());
                return true;
            default:
                return super.onKeyDown(code, e);
        }
    }
}
