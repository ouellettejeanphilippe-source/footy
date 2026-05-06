with open('app.js', 'r') as f:
    js = f.read()

zoom_functions = """
// --- ZOOM SYSTEM ---
var currentZoomLevel = 1.0;

function updateZoomDisplay() {
    var display = document.getElementById('zoom-level-display');
    if (display) {
        display.textContent = Math.round(currentZoomLevel * 100) + '%';
    }
}

function zoomIn() {
    if (currentZoomLevel < 3.0) {
        currentZoomLevel += 0.2;
        document.documentElement.style.setProperty('--zoom-level', currentZoomLevel);
        updateZoomDisplay();
        scrollToNow(); // Re-center
    }
}

function zoomOut() {
    if (currentZoomLevel > 0.4) {
        currentZoomLevel -= 0.2;
        document.documentElement.style.setProperty('--zoom-level', currentZoomLevel);
        updateZoomDisplay();
        scrollToNow(); // Re-center
    }
}

// Ensure the initial zoom displays correctly
document.addEventListener('DOMContentLoaded', updateZoomDisplay);
"""

# Append to the end of app.js
with open('app.js', 'a') as f:
    f.write('\n\n' + zoom_functions)
