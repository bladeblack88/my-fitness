import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html = await readFile('index.html', 'utf8');
assert.match(html, /<html lang="ru">/i, 'Russian document language');
assert.match(html, /localStorage/, 'local device storage is present');
assert.match(html, /таймер|timer/i, 'timer-related UI or logic is present');
assert.match(html, /Notification/, 'notification feature code is present');
assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/i, 'no external Google Fonts requests');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
assert.ok(scripts.length > 0, 'at least one inline application script');
for (const [i, match] of scripts.entries()) new vm.Script(match[1], { filename: `index-inline-${i + 1}.js` });
console.log('PASS: HTML smoke checks');
console.log('PASS: inline JavaScript syntax');
console.log('PASS: local storage and offline font checks');
const svgStart = html.indexOf('function svgArt(type)');
const svgEnd = html.indexOf('\\nfunction renderWorkout()', svgStart);
assert.ok(svgStart >= 0 && svgEnd > svgStart, 'exercise illustration renderer exists');
const svgRenderer = new Function(html.slice(svgStart, svgEnd) + '; return svgArt;')();
for (const type of ['push', 'squat', 'bridge', 'bird', 'scap']) {
  const svg = svgRenderer(type);
  assert.match(svg, /<svg/, `${type} illustration renders SVG`);
  assert.match(svg, /class="skin"/, `${type} illustration includes a recognizable head`);
  assert.match(svg, /anim-/, `${type} illustration has its own movement animation`);
}
console.log('PASS: five exercise illustrations and movement animations');

