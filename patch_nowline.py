import re

with open('styles.css', 'r') as f:
    css = f.read()

css = css.replace('.now-line { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--red); z-index: 10; pointer-events: none; display: none; box-shadow: 0 0 12px var(--red-glow); }',
                  '.now-line { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--red); z-index: 10; pointer-events: none; display: none; box-shadow: 0 0 12px var(--red-glow); left: calc((var(--now-h) * var(--hour-px)) + (var(--now-m) * var(--min-px))); }')

with open('styles.css', 'w') as f:
    f.write(css)
