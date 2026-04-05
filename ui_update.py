import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Title and Logo text
content = content.replace('<title>FootyFast</title>', '<title>Sports Guide</title>')
content = content.replace('FootyFast', 'Sports Guide')

# We can replace the whole style block to make it iOS like
style_start = content.find('<style>')
style_end = content.find('</style>') + 8

new_style = """<style>
:root {
  --bg: #000000;
  --bg2: #1c1c1e;
  --bg3: #2c2c2e;
  --chan-bg: #111112;
  --border: rgba(255, 255, 255, 0.1);
  --border2: rgba(255, 255, 255, 0.15);
  --accent: #0a84ff;
  --accent-green: #30d158;
  --red: #ff453a;
  --text: #ffffff;
  --muted: rgba(235, 235, 245, 0.6);
  --muted2: rgba(235, 235, 245, 0.8);
  --ruler-h: 44px;
  --chan-w: 160px;
  --row-h: 76px;
  --hour-px: 180px;
}
* { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { height: 100%; overflow: hidden; background: var(--bg); color: var(--text); }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; flex-direction: column; }

.hdr { height: 60px; flex-shrink: 0; background: rgba(28, 28, 30, 0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 0.5px solid var(--border2); display: flex; align-items: center; padding: 0 16px; gap: 12px; z-index: 100; position: relative; }
.logo { font-weight: 700; font-size: 22px; color: var(--text); display: flex; align-items: center; gap: 8px; text-decoration: none; letter-spacing: -0.5px; }
.ball { width: 28px; height: 28px; background: linear-gradient(135deg, var(--accent), #5e5ce6); border-radius: 50%; display: grid; place-items: center; flex-shrink: 0; box-shadow: 0 4px 10px rgba(10, 132, 255, 0.3); }
.ball svg { width: 15px; height: 15px; stroke: #fff; }
.sp { flex: 1; }
.btn { font-family: inherit; font-weight: 600; font-size: 14px; padding: 6px 14px; border-radius: 9999px; border: none; background: var(--bg3); color: var(--text); cursor: pointer; transition: all 0.2s; white-space: nowrap; }
.btn:hover { background: #3a3a3c; }
.btn:disabled { opacity: 0.5; cursor: default; }
.btn.g { background: rgba(48, 209, 88, 0.15); color: var(--accent-green); }
.btn.g:hover { background: rgba(48, 209, 88, 0.25); }
.btn.o { background: rgba(255, 159, 10, 0.15); color: #ff9f0a; }
.live-p { display: flex; align-items: center; gap: 4px; background: rgba(255, 69, 58, 0.15); color: var(--red); font-weight: 700; font-size: 12px; letter-spacing: 0.5px; padding: 4px 10px; border-radius: 6px; flex-shrink: 0; }
.ldot { width: 6px; height: 6px; border-radius: 50%; background: var(--red); animation: blink 1s infinite; }
@keyframes blink { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }

.sbar { height: 40px; flex-shrink: 0; background: var(--bg); border-bottom: 0.5px solid var(--border); display: flex; align-items: center; gap: 8px; padding: 0 16px; overflow-x: auto; scrollbar-width: none; font-size: 13px; color: var(--muted); }
.sbar::-webkit-scrollbar { display: none; }
.lchip { display: flex; align-items: center; gap: 6px; white-space: nowrap; padding: 4px 10px; border-radius: 9999px; cursor: pointer; user-select: none; transition: opacity 0.2s; background: rgba(255,255,255,0.08); font-weight: 500; }
.lchip:hover { background: rgba(255,255,255,0.12); }
.lchip.off { opacity: 0.4; filter: grayscale(1); }
.ldotc { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.vsep { width: 1px; height: 16px; background: var(--border); flex-shrink: 0; }
select.btn { appearance: none; -webkit-appearance: none; background: var(--bg3) url("data:image/svg+xml;utf8,<svg fill='%23fff' viewBox='0 0 24 24' width='16' height='16'><path d='M7 10l5 5 5-5z'/></svg>") no-repeat right 8px center; padding-right: 30px; }

.epg { flex: 1; display: flex; overflow: hidden; position: relative; }
.chan-col { width: var(--chan-w); flex-shrink: 0; display: flex; flex-direction: column; background: rgba(28, 28, 30, 0.5); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-right: 0.5px solid var(--border2); z-index: 20; position: relative; }
.corner { height: var(--ruler-h); flex-shrink: 0; border-bottom: 0.5px solid var(--border2); display: flex; align-items: center; padding: 0 16px; font-weight: 600; font-size: 11px; letter-spacing: 0.5px; color: var(--muted); text-transform: uppercase; background: var(--bg2); }
.chan-list { flex: 1; overflow-y: hidden; }
.chan-cell { height: var(--row-h); display: flex; flex-direction: column; justify-content: center; padding: 0 16px; gap: 4px; border-bottom: 0.5px solid var(--border); }

/* LIGUE HEADER CSS */
.lg-hdr { height: 36px; display: flex; align-items: center; padding: 0 16px; background: rgba(255,255,255,0.04); border-bottom: 0.5px solid var(--border); border-top: 0.5px solid var(--border); gap: 8px; cursor: pointer; user-select: none; }
.lg-hdr:hover { background: rgba(255,255,255,0.08); }
.lg-hdr.collapsed .lg-chev { transform: rotate(-90deg); }
.lg-chev { transition: transform 0.2s; font-size: 11px; color: var(--muted); }
.lg-title { font-size: 13px; font-weight: 600; letter-spacing: 0.5px; color: var(--muted2); text-transform: uppercase; }
.lg-cnt { margin-left: auto; font-size: 12px; color: var(--muted); background: var(--bg3); padding: 2px 8px; border-radius: 12px; }
.lg-row { display: none; }
.ch-flag { font-size: 14px; }
.ch-name { font-size: 13px; font-weight: 600; color: var(--text); line-height: 1.2; }
.ch-cnt { font-size: 11px; color: var(--muted); }

.tl { flex: 1; overflow: auto; background: var(--bg); }
.ruler { height: var(--ruler-h); position: sticky; top: 0; z-index: 15; background: rgba(28, 28, 30, 0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 0.5px solid var(--border2); display: flex; user-select: none; }
.tc { flex-shrink: 0; width: var(--hour-px); display: flex; align-items: center; padding-left: 12px; border-right: 0.5px solid var(--border); font-variant-numeric: tabular-nums; font-weight: 500; font-size: 12px; color: var(--muted2); }
.tc.nh { color: var(--red); font-weight: 700; }
.marea { position: relative; }
.mrow { height: var(--row-h); border-bottom: 0.5px solid var(--border); position: relative; }
.mrow:nth-child(even) { background: rgba(255,255,255,0.015); }
.gl { position: absolute; top: 0; bottom: 0; width: 0.5px; background: var(--border); pointer-events: none; }
.gl.h { background: rgba(255,255,255,0.03); }

.mb { position: absolute; top: 8px; bottom: 8px; border-radius: 10px; cursor: pointer; overflow: hidden; transition: transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.15s; display: flex; flex-direction: column; justify-content: center; padding: 8px 12px; min-width: 70px; border-left: 4px solid rgba(255,255,255,0.3); box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
.mb:hover { filter: brightness(1.15); transform: scale(1.02); z-index: 5; box-shadow: 0 8px 20px rgba(0,0,0,0.5); }
.mb.live { border-left-color: var(--text) !important; animation: liveglow 3s ease-in-out infinite; }
@keyframes liveglow { 0%, 100% { box-shadow: 0 4px 10px rgba(0,0,0,0.3) } 50% { box-shadow: 0 0 15px rgba(255, 69, 58, 0.4) } }
.mb-t { font-size: 13px; font-weight: 600; color: #fff; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.3px; }
.vs { color: rgba(255,255,255,0.5); font-weight: 400; font-size: 11px; margin: 0 4px; font-style: italic; }
.mb-m { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
.mb-time { font-variant-numeric: tabular-nums; font-size: 11px; font-weight: 500; color: rgba(255,255,255,0.7); }
.mb-score { font-weight: 800; font-size: 14px; color: #fff; background: rgba(0,0,0,0.2); padding: 0 6px; border-radius: 4px; letter-spacing: 1px; }
.mb-live { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: #fff; background: var(--red); padding: 2px 6px; border-radius: 4px; letter-spacing: 0.5px; }
.mb-ld { width: 5px; height: 5px; border-radius: 50%; background: #fff; animation: blink 1s infinite; }
.mb-sn { margin-left: auto; font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.15); border-radius: 4px; padding: 2px 6px; flex-shrink: 0; backdrop-filter: blur(4px); }

.now-line { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--red); z-index: 10; pointer-events: none; display: none; box-shadow: 0 0 8px rgba(255,69,58,0.6); }
.now-line::before { content: ''; position: absolute; top: -1px; left: -5px; width: 12px; height: 12px; border-radius: 50%; background: var(--red); box-shadow: 0 0 10px rgba(255,69,58,0.8); }
.now-line::after { content: attr(data-t); position: absolute; top: 16px; left: 8px; font-variant-numeric: tabular-nums; font-weight: 700; font-size: 11px; color: #fff; white-space: nowrap; background: var(--red); padding: 2px 6px; border-radius: 6px; box-shadow: 0 2px 8px rgba(255,69,58,0.4); }

/* OVERLAY */
.ov { position: absolute; inset: 0; z-index: 100; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; }
.spinner { width: 48px; height: 48px; border-radius: 50%; border: 4px solid var(--border2); border-top-color: var(--accent); animation: spin 1s cubic-bezier(0.5, 0.1, 0.4, 0.9) infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.ov-msg { font-size: 16px; font-weight: 500; color: var(--text); text-align: center; max-width: 300px; }
.step { display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 500; color: var(--muted); transition: all 0.3s; }
.sic { width: 18px; height: 18px; flex-shrink: 0; }
.sic.ok { color: var(--accent-green); }

/* ERROR */
.err { position: absolute; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 24px; text-align: center; background: rgba(0,0,0,0.9); z-index: 100; }
.err.show { display: flex; }
.err-msg { font-size: 15px; font-weight: 500; color: var(--text); max-width: 400px; line-height: 1.5; }
.err-code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; color: var(--red); background: rgba(255,69,58,0.1); border: 1px solid rgba(255,69,58,0.2); border-radius: 8px; padding: 12px 16px; max-width: 460px; width: 100%; text-align: left; max-height: 120px; overflow-y: auto; }

/* MODAL */
.mbg { display: none; position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); align-items: center; justify-content: center; padding: 16px; }
.mbg.open { display: flex; }
.modal { background: rgba(28, 28, 30, 0.95); border: 0.5px solid rgba(255,255,255,0.15); border-radius: 18px; width: 100%; max-width: 480px; overflow: hidden; animation: mopen 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); box-shadow: 0 20px 40px rgba(0,0,0,0.5); display: flex; flex-direction: column; }
@keyframes mopen { from { opacity: 0; transform: scale(0.9) translateY(20px) } to { opacity: 1; transform: scale(1) translateY(0) } }
.mhd { padding: 20px 24px 16px; border-bottom: 0.5px solid var(--border); display: flex; align-items: flex-start; gap: 12px; background: rgba(255,255,255,0.02); }
.mdot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; margin-top: 6px; box-shadow: 0 0 10px rgba(255,255,255,0.2); }
.mi { flex: 1; }
.mn { font-weight: 700; font-size: 18px; line-height: 1.2; letter-spacing: -0.5px; }
.mm { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.mtag { font-size: 12px; font-weight: 600; color: var(--muted2); background: var(--bg3); padding: 4px 10px; border-radius: 6px; }
.msc { font-weight: 800; font-size: 24px; color: var(--text); background: rgba(255,255,255,0.1); padding: 4px 12px; border-radius: 10px; letter-spacing: 1px; }
.mx { width: 32px; height: 32px; border-radius: 16px; background: rgba(255,255,255,0.1); color: var(--muted2); cursor: pointer; display: grid; place-items: center; font-size: 14px; flex-shrink: 0; transition: background 0.2s; }
.mx:hover { background: rgba(255,255,255,0.2); color: var(--text); }
.mbody { padding: 16px 24px; display: flex; flex-direction: column; gap: 10px; max-height: 60vh; overflow-y: auto; }
.si { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 14px; background: rgba(255,255,255,0.04); border: 0.5px solid rgba(255,255,255,0.05); cursor: pointer; transition: all 0.2s; text-decoration: none; color: var(--text); }
.si:hover { background: rgba(255,255,255,0.08); transform: translateY(-1px); border-color: rgba(255,255,255,0.15); }
.si-ic { width: 36px; height: 36px; border-radius: 10px; background: rgba(0,0,0,0.3); display: grid; place-items: center; font-size: 18px; flex-shrink: 0; }
.si-inf { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
.si-n { font-weight: 600; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.2px; }
.si-s { font-size: 12px; color: var(--muted); margin-top: 2px; }
.sbadge { font-weight: 700; font-size: 11px; letter-spacing: 0.5px; padding: 3px 8px; border-radius: 6px; flex-shrink: 0; }
.bHD { background: rgba(48, 209, 88, 0.2); color: var(--accent-green); }
.bSD { background: rgba(255,255,255,0.1); color: var(--muted2); }
.b4K { background: rgba(10, 132, 255, 0.2); color: var(--accent); }
.sarr { color: var(--muted); transition: color 0.2s; flex-shrink: 0; }
.mft { padding: 12px 24px 16px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 12px; font-weight: 500; color: var(--muted); background: rgba(0,0,0,0.2); border-top: 0.5px solid var(--border); }

.toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px); z-index: 600; background: rgba(28, 28, 30, 0.9); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); color: var(--text); font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 9999px; opacity: 0; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); pointer-events: none; display: flex; align-items: center; gap: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 0.5px solid rgba(255,255,255,0.1); }
.toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

@media(max-width: 680px) {
  :root { --chan-w: 90px; --row-h: 68px; --hour-px: 140px; --ruler-h: 40px; }
  .ch-cnt, .mb-sn { display: none; }
  .ch-name { font-size: 11px; }
  .hdr { padding: 0 12px; gap: 8px; }
  .logo { font-size: 18px; }
  .btn { padding: 6px 12px; font-size: 13px; }
  .mb { padding: 6px 10px; }
  .mb-t { font-size: 12px; }
  .mb-score { font-size: 12px; }
}

/* DEBUG */
.dbg { position: fixed; inset: 0; z-index: 500; background: rgba(0,0,0,0.96); backdrop-filter: blur(10px); display: none; flex-direction: column; }
.dbg.open { display: flex; }
.dbg-hd { padding: 16px 20px; border-bottom: 0.5px solid var(--border2); display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.dbg-title { font-weight: 700; font-size: 18px; flex: 1; letter-spacing: -0.5px; }
.dbg-x { width: 32px; height: 32px; background: rgba(255,255,255,0.1); border-radius: 16px; color: var(--text); cursor: pointer; display: grid; place-items: center; font-size: 14px; }
.dbg-body { flex: 1; overflow: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.dbg-sect { background: rgba(28, 28, 30, 0.6); border: 0.5px solid var(--border); border-radius: 12px; overflow: hidden; }
.dbg-sect-title { font-size: 13px; font-weight: 700; padding: 10px 16px; background: rgba(255,255,255,0.05); border-bottom: 0.5px solid var(--border); color: var(--accent); letter-spacing: 0.5px; text-transform: uppercase; }
.dbg-code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; padding: 16px; white-space: pre-wrap; word-break: break-all; color: var(--muted2); max-height: 300px; overflow-y: auto; line-height: 1.6; }
</style>"""

content = content[:style_start] + new_style + content[style_end:]

# Replace Google Fonts links since we are using apple system fonts now
content = re.sub(r'<link href="https://fonts\.googleapis\.com/css2.*?>', '', content)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
