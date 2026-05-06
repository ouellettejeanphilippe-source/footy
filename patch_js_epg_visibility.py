with open('app.js', 'r') as f:
    js = f.read()

# Make sure to hide/show zoom controls correctly
filter_replace = """function applyFilter(f){
  if(S.view === 'mv') return;
  S.filter=f;
  updateUrl();
  document.getElementById('epg').style.display='none';

  var zoomControls = document.querySelector('.zoom-controls');
  if (zoomControls) zoomControls.style.display = 'none';"""

js = js.replace("""function applyFilter(f){
  if(S.view === 'mv') return;
  S.filter=f;
  updateUrl();
  document.getElementById('epg').style.display='none';""", filter_replace)


filter_replace2 = """document.getElementById('epg').style.display='block';

    var zoomControls = document.querySelector('.zoom-controls');
    if (zoomControls) zoomControls.style.display = 'flex';"""

js = js.replace("""document.getElementById('epg').style.display='block';""", filter_replace2)

with open('app.js', 'w') as f:
    f.write(js)
