import datetime

now = datetime.datetime.now().strftime("%d %b %Y")

entry = f"""

### {now} - Redesign du Guide Vertical sur Mobile
- **Fichiers touchés** : `styles.css`, `js/ui.js`
- **Résumé** : Changement complet de la disposition de la vue "Guide" (EPG timeline) sur les appareils mobiles (`max-width: 768px`). La timeline défile dorénavant verticalement de haut en bas (comme l'application Google Calendar en vue Journalière), en intervertissant l'axe temporel (maintenant vertical) et l'axe des chaînes/ligues (maintenant horizontal). Le JS a été simplifié pour utiliser les custom properties CSS, ce qui permet à `styles.css` de contrôler la position absolue et les hauteurs avec flexbox. La fonction de scrolling automatique (`scrollToNow`) a également été modifiée pour contrôler le `scrollTop` au lieu de `scrollLeft` sur mobile.
- **Problèmes résolus** : La lisibilité de la timeline sur de très petits écrans était complexe. Ce nouveau design de calendrier mobile est plus intuitif.
"""

with open("docs/WORKLOG.md", "r") as f:
    content = f.read()

with open("docs/WORKLOG.md", "w") as f:
    f.write(entry + content)
