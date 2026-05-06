import re

with open('styles.css', 'r') as f:
    css = f.read()

# Add zoom controls to the nav-links styles or global
zoom_css = """
/* Zoom Controls */
.zoom-controls {
  display: flex;
  align-items: center;
  background: rgba(255,255,255,0.1);
  border-radius: 8px;
  overflow: hidden;
  margin-left: auto;
  margin-right: 15px;
}
.zoom-btn {
  background: transparent;
  border: none;
  color: white;
  padding: 6px 12px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}
.zoom-btn:hover {
  background: rgba(255,255,255,0.2);
}
.zoom-level {
  font-size: 12px;
  font-weight: 600;
  padding: 0 8px;
  min-width: 3ch;
  text-align: center;
}
@media (max-width: 768px) {
  .zoom-controls {
    position: fixed;
    bottom: 80px;
    right: 15px;
    z-index: 100;
    background: rgba(0,0,0,0.8);
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.2);
  }
}
"""

css += zoom_css

with open('styles.css', 'w') as f:
    f.write(css)
