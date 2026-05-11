const { execSync } = require('child_process');

console.log(execSync('date').toString());
let d = new Date();
let formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
});
console.log(formatter.format(d));
