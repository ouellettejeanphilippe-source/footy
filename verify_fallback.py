from playwright.sync_api import sync_playwright
import time

def run_cuj(page):
    page.route("**/*", lambda route: route.continue_())

    # We will click on the first match to see the modal
    page.goto("http://localhost:3000")
    page.wait_for_timeout(2000)

    # Run the UI creation code
    page.evaluate('''
        var rightCol = document.createElement("div");
        rightCol.id = "modal-right-content";
        document.body.appendChild(rightCol);

        var stats = { matched: 16, total: 25 };
        var statColor = '#34c759';

        var site = { url: '#', name: 'Buffstreams' };

        var contentHtml = '<div style="margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">';
        contentHtml += '<details open style="color: var(--muted); cursor: pointer;"><summary style="outline:none; font-weight: 500;">Recherche manuelle & Sites de base (Fallback)</summary>';
        contentHtml += '<div style="padding: 10px 0; display: flex; flex-wrap: wrap; gap: 8px;">';

        var statHtml = ' <span style="font-size: 10px; margin-left: 4px; color: '+statColor+';" title="Matchs trouvés sur ce site (globalement)">('+stats.matched+'/'+stats.total+' matchs)</span>';

        contentHtml += '<a href="'+site.url+'" target="_blank" class="mtag" style="background: rgba(255,255,255,0.05); color: #fff; padding: 5px; text-decoration: none; display: inline-flex; align-items: center;">'+site.name+' 🔗' + statHtml + '</a>';

        contentHtml += '</div></details></div>';

        rightCol.innerHTML = contentHtml;

        // Let's force hover to see the tooltip
        var tag = document.querySelector('.mtag span');
        if (tag) {
            var event = new MouseEvent('mouseover', {
                'view': window,
                'bubbles': true,
                'cancelable': true
            });
            tag.dispatchEvent(event);
        }
    ''')

    page.wait_for_timeout(1000)
    page.screenshot(path="/home/jules/verification/screenshots/verification.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={'width': 1280, 'height': 720}
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
