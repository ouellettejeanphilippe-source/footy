function parseTime(rawTime) {
  var timeM = rawTime.match(/^(\d{1,2}):(\d{2})$/);
  var scoreM = rawTime.match(/(\d+)\s*[-–]\s*(\d+)/);
  var minM = rawTime.match(/(\d{1,3})'|HT|FT|Live/i);
  var startsInM = rawTime.match(/Starts in (?:(\d+)hr:)?(\d+)min/i);
  var matchStartedM = rawTime.match(/Match Started/i);

  var status = 'upcoming';
  var minute = null;

  if (timeM) {
    status = 'upcoming';
  } else if (startsInM) {
    status = 'upcoming';
  } else if (matchStartedM) {
    status = 'live';
  } else if (scoreM) {
    if (minM && /FT/i.test(minM[0])) {
      status = 'finished';
    } else {
      status = 'live';
    }
  } else if (minM) {
    var mText = minM[0];
    if (/FT/i.test(mText)) {
      status = 'finished';
    } else {
      status = 'live';
      minute = minM[1] || mText;
    }
  }
  return { status, minute };
}

console.log('FT ->', parseTime('FT'));
console.log('HT ->', parseTime('HT'));
console.log('Live ->', parseTime('Live'));
console.log('45\' ->', parseTime('45\''));
console.log('Match Started ->', parseTime('Match Started'));
console.log('1 - 0 ->', parseTime('1 - 0'));
console.log('1 - 0 FT ->', parseTime('1 - 0 FT'));
