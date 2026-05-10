import re

with open('js/main.js', 'r') as f:
    content = f.read()

func = """export function switchFavTab(tab) {
    var container = document.getElementById('fav-container');
    var tabTeams = document.getElementById('fav-tab-teams');
    var tabLeagues = document.getElementById('fav-tab-leagues');

    if (tab === 'leagues') {
        container.classList.add('show-leagues');
        tabTeams.classList.remove('active-toggle');
        tabLeagues.classList.add('active-toggle');
    } else {
        container.classList.remove('show-leagues');
        tabLeagues.classList.remove('active-toggle');
        tabTeams.classList.add('active-toggle');
    }
}

"""

content = content.replace("export function filterFavTeams(query) {", func + "export function filterFavTeams(query) {")
content = content.replace("window.filterFavTeams = filterFavTeams;", "window.filterFavTeams = filterFavTeams;\nwindow.switchFavTab = switchFavTab;")

with open('js/main.js', 'w') as f:
    f.write(content)
