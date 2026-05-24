import re

with open('js/multiview.js', 'r') as f:
    content = f.read()

# Locate the drag and drop events assignment logic
# Look for:
# cell.ondragstart = function(e) { ... };
# ...
# cell.ondrop = function(e) { ... };

# We will modify `ondragstart` to set window.draggedMvIdx
# And we will add `ondragenter` to perform the swap
# And we will modify `ondragend` to clean up and save/update

# It might be easier to replace using regex

patch = """        cell.ondragstart = function(e) {
            e.dataTransfer.setData('text/plain', idx.toString());
            window.draggedMvIdx = idx;
            cell.style.opacity = '0.5';
        };
        cell.ondragend = function(e) {
            cell.style.opacity = '1';
            cell.draggable = false;
            window.draggedMvIdx = null;
            saveMultivisionState();
            updateMultivisionLayout();
        };
        cell.ondragenter = function(e) {
            e.preventDefault();
            var fromIdx = window.draggedMvIdx;
            var toIdx = idx;
            if (fromIdx !== null && fromIdx !== undefined && fromIdx !== toIdx && !isNaN(fromIdx)) {
                var temp = mvFlux[fromIdx];
                mvFlux[fromIdx] = mvFlux[toIdx];
                mvFlux[toIdx] = temp;
                window.draggedMvIdx = toIdx; // Update tracked index after swap
                saveMultivisionState();
                updateMultivisionLayout();
            }
        };
        cell.ondragover = function(e) {
            e.preventDefault();
            // Optional: visual indicator here if wanted
        };
        cell.ondragleave = function(e) {
            // No action needed
        };
        cell.ondrop = function(e) {
            e.preventDefault();
            // Swapping already handled in dragenter
        };"""

content = re.sub(r"        cell\.ondragstart = function\(e\) \{.*?        };\s*cell\.ondrop = function\(e\) \{.*?\};", patch, content, flags=re.DOTALL)

with open('js/multiview.js', 'w') as f:
    f.write(content)
