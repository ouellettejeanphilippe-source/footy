import re

with open("index.html", "r") as f:
    content = f.read()

# Update Match Selector
content = re.sub(
    r"selector\.style\.cssText = 'position:absolute;z-index:999;background:rgba\(20,20,20,0\.95\);border:1px solid rgba\(255,255,255,0\.2\);border-radius:8px;padding:8px;backdrop-filter:blur\(10px\);display:flex;flex-direction:column;gap:4px;max-height:400px;overflow-y:auto;box-shadow:0 10px 25px rgba\(0,0,0,0\.8\);width:300px;';",
    r"selector.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);z-index:9999;background:rgba(20,20,20,0.95);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:12px;backdrop-filter:blur(15px);display:flex;flex-direction:column;gap:8px;max-height:80vh;overflow-y:auto;box-shadow:0 15px 40px rgba(0,0,0,0.8);width:90%;max-width:320px;-webkit-overflow-scrolling:touch;';",
    content
)

# Remove click positioning for Match Selector
content = re.sub(
    r"// Position based on click\s*if \(event\) \{[\s\S]*?\} else \{\s*selector\.style\.top = '50px';\s*selector\.style\.left = '50px';\s*\}",
    r"// Centered using position fixed",
    content
)

# Update Layout Selector
content = re.sub(
    r"selector\.style\.cssText = 'position:absolute;z-index:999;background:rgba\(20,20,20,0\.95\);border:1px solid rgba\(255,255,255,0\.2\);border-radius:8px;padding:8px;backdrop-filter:blur\(10px\);display:flex;flex-direction:column;gap:4px;width:180px;box-shadow:0 10px 25px rgba\(0,0,0,0\.8\);';",
    r"selector.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);z-index:9999;background:rgba(20,20,20,0.95);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:12px;backdrop-filter:blur(15px);display:flex;flex-direction:column;gap:4px;width:90%;max-width:220px;box-shadow:0 15px 40px rgba(0,0,0,0.8);';",
    content
)

# Remove click positioning for Layout Selector
content = re.sub(
    r"if \(event\) \{\s*var rect = event\.target\.getBoundingClientRect\(\);\s*selector\.style\.top = \(rect\.bottom \+ 5\) \+ 'px';\s*selector\.style\.left = rect\.left \+ 'px';\s*\}",
    r"// Centered using position fixed",
    content
)

with open("index.html", "w") as f:
    f.write(content)
