import sys

with open('js/multiview.js', 'r') as f:
    content = f.read()

# Insert functions right before the end where window bindings are
insert_pos = content.rfind('// Global bindings for HTML compatibility')

investigator_code = """
/* ══ SCRAPER INVESTIGATOR ══════════════ */
export var investigatorSequence = [];
export var investigatorCurrentUrl = '';

export function openInvestigatorModal() {
    var modal = document.getElementById('investigator-modal');
    if (modal) {
        modal.style.display = 'flex';
        investigatorClearSequence();
    }
}

export function investigatorClearSequence() {
    investigatorSequence = [];
    investigatorCurrentUrl = '';
    document.getElementById('investigator-url').value = '';
    document.getElementById('investigator-content').innerHTML = '<div style="color: rgba(255,255,255,0.5); text-align: center; margin-top: 40px;">Entrez une URL pour commencer l\'investigation du DOM.</div>';
    renderInvestigatorSequence();
}

function renderInvestigatorSequence() {
    var seqContainer = document.getElementById('investigator-sequence');
    if (!seqContainer) return;

    if (investigatorSequence.length === 0) {
        seqContainer.innerHTML = '<div style="color: rgba(255,255,255,0.5);">Aucune action (Démarrez l\\'analyse)</div>';
        return;
    }

    var html = '';
    investigatorSequence.forEach(function(step, idx) {
        var actionText = step.type === 'click_link' ? '🔗 Clic lien: ' + esc(step.textMatch || step.href) : '📺 Sélection iframe (Index ' + step.iframeIndex + ')';
        html += '<div style="background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 4px; border-left: 2px solid #ffcc00; font-size: 11px;">' +
                   '<span style="opacity: 0.6; margin-right: 8px;">Étape ' + (idx+1) + '</span>' + actionText +
                '</div>';
    });
    seqContainer.innerHTML = html;
}

export function investigateUrl(url) {
    if (!url || !url.startsWith('http')) {
        showToast('URL invalide (doit commencer par http)');
        return;
    }

    investigatorCurrentUrl = url;
    document.getElementById('investigator-url').value = url;
    document.getElementById('investigator-content').innerHTML = '<div style="color: var(--muted); text-align: center;">Chargement de ' + esc(url) + '...</div>';

    fetchPage(url).then(function(html) {
        renderInvestigatorDom(html, url);
    }).catch(function(e) {
        document.getElementById('investigator-content').innerHTML = '<div style="color: var(--red); text-align: center;">Erreur de chargement: ' + esc(e.message) + '</div>';
    });
}

export function renderInvestigatorDom(html, baseUrl) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var container = document.getElementById('investigator-content');

    var outHtml = '<div style="margin-bottom: 12px; font-size: 14px; font-weight: bold;">Éléments interactifs trouvés sur la page :</div>';

    // Find all links that look like stream links or overlays
    var links = doc.querySelectorAll('a[href]');
    var validLinks = [];
    for (var i=0; i<links.length; i++) {
        var h = links[i].getAttribute('href');
        if (!h || h.startsWith('javascript') || h === '#') continue;
        validLinks.push(links[i]);
    }

    if (validLinks.length > 0) {
        outHtml += '<div style="margin-bottom: 8px; color: #a1a1aa; font-weight: bold;">Liens (<a>)</div>';
        outHtml += '<div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px;">';
        validLinks.forEach(function(link) {
            var href = link.getAttribute('href');
            var text = link.textContent.replace(/\s+/g, ' ').trim() || '(Lien sans texte)';
            outHtml += '<div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 4px; border-left: 2px solid #0a84ff;">' +
                          '<div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;">' +
                              '<div style="font-weight: bold; color: #fff;">' + esc(text) + '</div>' +
                              '<div style="font-size: 10px; color: #a1a1aa;">' + esc(href) + '</div>' +
                          '</div>' +
                          '<button class="btn o" style="font-size: 11px; padding: 4px 8px;" onclick="window.investigatorClickLink(\\'' + escJs(href) + '\\', \\'' + escJs(text) + '\\')">Simuler Clic</button>' +
                       '</div>';
        });
        outHtml += '</div>';
    }

    // Find iframes (the ultimate goal usually)
    var iframes = doc.querySelectorAll('iframe');
    if (iframes.length > 0) {
        outHtml += '<div style="margin-bottom: 8px; color: #ffcc00; font-weight: bold;">Lecteurs Vidéo (<iframe>)</div>';
        outHtml += '<div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px;">';
        [].forEach.call(iframes, function(ifr, idx) {
            var src = ifr.getAttribute('src') || '(Pas de src)';
            outHtml += '<div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,165,0,0.1); padding: 8px; border-radius: 4px; border-left: 2px solid #ffcc00;">' +
                          '<div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;">' +
                              '<div style="font-weight: bold; color: #ffcc00;">Iframe #' + idx + '</div>' +
                              '<div style="font-size: 10px; color: #a1a1aa;">' + esc(src) + '</div>' +
                          '</div>' +
                          '<button class="btn g" style="font-size: 11px; padding: 4px 8px;" onclick="window.investigatorSelectIframe(' + idx + ')">Sélectionner Lecteur</button>' +
                       '</div>';
        });
        outHtml += '</div>';
    }

    if (validLinks.length === 0 && iframes.length === 0) {
        outHtml += '<div style="color: var(--muted); text-align: center; padding: 20px;">Aucun lien ni iframe pertinent trouvé.</div>';
    }

    container.innerHTML = outHtml;
}

export function investigatorClickLink(href, textMatch) {
    investigatorSequence.push({
        type: 'click_link',
        href: href,
        textMatch: textMatch
    });
    renderInvestigatorSequence();

    // Navigate to next page
    var fullUrl = typeof resolveUrl === 'function' ? resolveUrl(href, investigatorCurrentUrl) : (href.startsWith('http') ? href : new URL(href, investigatorCurrentUrl).href);
    investigateUrl(fullUrl);
}

export function investigatorSelectIframe(iframeIndex) {
    investigatorSequence.push({
        type: 'iframe_select',
        iframeIndex: iframeIndex
    });
    renderInvestigatorSequence();
    showToast('Iframe sélectionnée. N\\'oubliez pas de sauvegarder.');
}

export function investigatorSaveRules() {
    if (investigatorSequence.length === 0) {
        showToast('La séquence est vide.');
        return;
    }

    var domain = getDomain(investigatorCurrentUrl);
    if (!domain) {
        showToast('Impossible de déterminer le domaine.');
        return;
    }

    var customRules = safeStorageGetJSON('custom_scraper_rules', {});
    customRules[domain] = {
        updatedAt: Date.now(),
        steps: investigatorSequence
    };
    safeStorageSetJSON('custom_scraper_rules', customRules);

    showToast('Règles sauvegardées pour ' + domain);
    document.getElementById('investigator-modal').style.display = 'none';
}

"""

new_content = content[:insert_pos] + investigator_code + content[insert_pos:]

# Add imports for fetchPage if missing
if 'fetchPage' not in new_content.split('export')[0]:
    import_line = "import { fetchPage } from './utils.js';\n"
    new_content = import_line + new_content

with open('js/multiview.js', 'w') as f:
    f.write(new_content)
