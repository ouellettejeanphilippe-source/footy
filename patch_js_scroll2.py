import re

with open('app.js', 'r') as f:
    js = f.read()

# Try a regex approach to find and replace updateNowLine since literal string replace failed due to slight differences
js = re.sub(r'function updateNowLine\(\)\s*\{.*?\n\}', '''function updateNowLine() {
    var line = document.getElementById('nowline');
    if(!line) return;

    var now = new Date();
    var isToday = (TARGET_DATE.toDateString() === now.toDateString());

    if(isToday) {
        var estStr = getEstTimeStrFromDate(now);
        var parts = estStr.split(':');
        var h = parseInt(parts[0], 10);
        var m = parseInt(parts[1], 10);

        line.style.setProperty('--now-h', h);
        line.style.setProperty('--now-m', m);
        line.style.display = 'block';
        line.setAttribute('data-t', estStr);
    } else {
        line.style.display = 'none';
    }
}''', js, flags=re.DOTALL)

js = re.sub(r'function scrollToNow\(\)\s*\{.*?\n\}', '''function scrollToNow(){
    var epgContainer = document.getElementById('epg');
    if(!epgContainer || S.view !== 'epg' || epgContainer.style.display === 'none') return;

    var now = new Date();
    var isToday = (TARGET_DATE.toDateString() === now.toDateString());
    if(!isToday) return;

    var rootStyles = getComputedStyle(document.documentElement);
    var hourPx = parseFloat(rootStyles.getPropertyValue('--hour-px')) || (window.innerWidth <= 768 ? 140 : 220);
    var minPx = hourPx / 60;

    var estStr = getEstTimeStrFromDate(now);
    var parts = estStr.split(':');
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);

    var w = epgContainer.clientWidth;
    var chanW = parseFloat(rootStyles.getPropertyValue('--chan-w')) || (window.innerWidth <= 768 ? 100 : 240);
    var leftPx = (h * hourPx) + (m * minPx) + chanW;

    epgContainer.scrollLeft = Math.max(0, leftPx - (w / 2));
}''', js, flags=re.DOTALL)

with open('app.js', 'w') as f:
    f.write(js)
