import fs from 'fs';

let g = {
    date_played: "2026-05-11T23:00:00Z"
};

let dateObj = new Date(g.date_played);

let formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
});

var matchDate = formatter.format(dateObj);
var startTime = ('0' + dateObj.getHours()).slice(-2) + ':' + ('0' + dateObj.getMinutes()).slice(-2);

console.log("Date:", matchDate, "Time:", startTime);
