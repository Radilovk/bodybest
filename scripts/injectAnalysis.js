import { readFileSync, writeFileSync } from 'fs';

const [apiUrl, userId, source = 'reganalize/analyze.html', output = 'analyze.html'] = process.argv.slice(2);

if (!apiUrl || !userId) {
  console.log('Usage: node scripts/injectAnalysis.js <apiUrl> <userId> [sourceHtml] [outputHtml]');
  process.exit(1);
}

const res = await fetch(`${apiUrl}/api/getInitialAnalysis?userId=${userId}`);
if (!res.ok) {
  console.error('Failed to fetch analysis:', res.status, res.statusText);
  process.exit(1);
}

const data = await res.json();
if (!data.analysis) {
  console.error('Invalid response from API');
  process.exit(1);
}

const html = readFileSync(source, 'utf8').replace('/*---JSON_DATA_PLACEHOLDER---*/', JSON.stringify(data.analysis));
writeFileSync(output, html);
console.log(`Saved analysis to ${output}`);

