const fs = require('fs');
const html = fs.readFileSync('footyfast-guide(4).html', 'utf8');

// Basic sanity check to make sure there are no syntax errors
try {
  // Extract content between <script> and </script>
  const scriptContent = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  new Function(scriptContent);
  console.log('Script parsed successfully.');
} catch (e) {
  console.error('Error parsing script:', e);
}
