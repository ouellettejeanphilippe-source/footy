import sys

with open('js/multiview.js', 'r') as f:
    content = f.read()

# Add window bindings for investigator functions
bindings = """
window.openInvestigatorModal = openInvestigatorModal;
window.investigatorClearSequence = investigatorClearSequence;
window.investigateUrl = investigateUrl;
window.investigatorClickLink = investigatorClickLink;
window.investigatorSelectIframe = investigatorSelectIframe;
window.investigatorSaveRules = investigatorSaveRules;
"""

if 'window.openInvestigatorModal' not in content:
    content = content.replace('// Global bindings for HTML compatibility', '// Global bindings for HTML compatibility\n' + bindings)

with open('js/multiview.js', 'w') as f:
    f.write(content)
