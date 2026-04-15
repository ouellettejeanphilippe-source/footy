const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

// Also update btn shapes from presets
let oldThemeBody = `    userPrefs.c3 = presets[theme].c3;
    userPrefs.accent = presets[theme].accent;
    userPrefs.theme = theme;

    // Update inputs (do not override background style automatically to allow better mix and match)
    document.getElementById('pref-c1').value = userPrefs.c1;
    document.getElementById('pref-c2').value = userPrefs.c2;
    document.getElementById('pref-c3').value = userPrefs.c3;
    document.getElementById('pref-accent-color').value = userPrefs.accent;

    applyUserPrefs();`;

let newThemeBody = `    userPrefs.c3 = presets[theme].c3;
    userPrefs.accent = presets[theme].accent;
    userPrefs.theme = theme;

    // Auto-map btnShape based on theme if it's a specific system theme
    if(['ps2', 'xbox', 'samsung', 'windows', 'macos', 'ubuntu'].includes(theme)) {
        userPrefs.btnShape = theme;
        var btnSel = document.getElementById('pref-btn-shape');
        if(btnSel) btnSel.value = theme;
    } else if (theme === 'monochrome') {
        userPrefs.btnShape = 'square';
        var btnSel = document.getElementById('pref-btn-shape');
        if(btnSel) btnSel.value = 'square';
    } else {
        // Leave user's current btnShape preference
    }

    // Update inputs (do not override background style automatically to allow better mix and match)
    document.getElementById('pref-c1').value = userPrefs.c1;
    document.getElementById('pref-c2').value = userPrefs.c2;
    document.getElementById('pref-c3').value = userPrefs.c3;
    document.getElementById('pref-accent-color').value = userPrefs.accent;

    applyUserPrefs();`;

content = content.replace(oldThemeBody, newThemeBody);

fs.writeFileSync('index.html', content);
