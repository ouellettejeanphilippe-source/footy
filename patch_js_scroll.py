import re

with open('app.js', 'r') as f:
    js = f.read()

# Remove the old Sync scroll block
sync_block = """  // Sync scroll
  if(chanList && tl) {
      chanList.onscroll = function() { tl.scrollTop = chanList.scrollTop; };
      tl.onscroll = function() { chanList.scrollTop = tl.scrollTop; };
  }"""
js = js.replace(sync_block, "")

# Update updateNowLine and scrollToNow
update_now_block = """function updateNowLine() {
    var line = document.getElementById('nowline');
    if(!line) return;

    // Check if target date is today
    var now = new Date();
    var isToday = (TARGET_DATE.toDateString() === now.toDateString());

    if(isToday) {
        var hourPx = window.innerWidth <= 680 ? 160 : 220;
        var minPx = hourPx / 60;
        var h = now.getHours();
        var m = now.getMinutes();
        var leftPx = (h * hourPx) + (m * minPx);
        line.style.left = leftPx + 'px';
        line.style.display = 'block';
        line.setAttribute('data-t', pad(h) + ':' + pad(m));
    } else {
        line.style.display = 'none';
    }
}"""

new_update_now_block = """function updateNowLine() {
    var line = document.getElementById('nowline');
    if(!line) return;

    var now = new Date();
    var isToday = (TARGET_DATE.toDateString() === now.toDateString());

    if(isToday) {
        var h = now.getHours();
        var m = now.getMinutes();
        line.style.setProperty('--now-h', h);
        line.style.setProperty('--now-m', m);
        line.style.display = 'block';
        line.setAttribute('data-t', pad(h) + ':' + pad(m));
    } else {
        line.style.display = 'none';
    }
}"""

js = js.replace(update_now_block, new_update_now_block)

scroll_to_now_block = """function scrollToNow(){
    var epgContainer = document.getElementById('epg');
    var tl = document.getElementById('tl');
    if(!tl || S.view !== 'epg' || epgContainer.style.display === 'none') return;

    var now = new Date();
    var isToday = (TARGET_DATE.toDateString() === now.toDateString());
    if(!isToday) return;

    var hourPx = window.innerWidth <= 680 ? 160 : 220;
    var minPx = hourPx / 60;
    var h = now.getHours();
    var m = now.getMinutes();

    // Center the current time
    var w = tl.clientWidth;
    var leftPx = (h * hourPx) + (m * minPx);

    // Scroll to position
    tl.scrollLeft = Math.max(0, leftPx - (w / 2));
}"""

new_scroll_to_now_block = """function scrollToNow(){
    var epgContainer = document.getElementById('epg');
    if(!epgContainer || S.view !== 'epg' || epgContainer.style.display === 'none') return;

    var now = new Date();
    var isToday = (TARGET_DATE.toDateString() === now.toDateString());
    if(!isToday) return;

    // Use CSS zoom vars
    var rootStyles = getComputedStyle(document.documentElement);
    var hourPx = parseFloat(rootStyles.getPropertyValue('--hour-px')) || (window.innerWidth <= 768 ? 140 : 220);
    var minPx = hourPx / 60;
    var h = now.getHours();
    var m = now.getMinutes();

    var w = epgContainer.clientWidth;
    var chanW = parseFloat(rootStyles.getPropertyValue('--chan-w')) || (window.innerWidth <= 768 ? 100 : 240);
    var leftPx = (h * hourPx) + (m * minPx) + chanW;

    epgContainer.scrollLeft = Math.max(0, leftPx - (w / 2));
}"""

js = js.replace(scroll_to_now_block, new_scroll_to_now_block)

with open('app.js', 'w') as f:
    f.write(js)
