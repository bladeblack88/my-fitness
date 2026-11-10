import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = await readFile('index.html', 'utf8');
assert.match(html, /<html lang="ru">/i, 'Russian document language');
assert.match(html, /localStorage/, 'local device storage is present');
assert.match(html, /Notification/, 'notification feature code is present');
assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/i, 'no external Google Fonts requests');

const scriptMatches = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
assert.ok(scriptMatches.length > 0, 'at least one inline application script');
for (const [i, match] of scriptMatches.entries()) new vm.Script(match[1], { filename: 'index-inline-' + (i + 1) + '.js' });
console.log('PASS: HTML smoke checks and inline JavaScript syntax');

const markup = html.slice(0, html.indexOf('<script'));
const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(x => x[1]);
assert.equal(ids.length, new Set(ids).size, 'static HTML IDs are unique');
const declaredFunctions = new Set([...html.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(x => x[1]));
const clickHandlers = [...html.matchAll(/onclick="([A-Za-z_$][\w$]*)\s*\(/g)].map(x => x[1]).filter(name => name.charCodeAt(0) !== 36);
for (const name of clickHandlers) assert.ok(declaredFunctions.has(name), 'onclick handler ' + name + ' has an implementation');
assert.ok(clickHandlers.length >= 20, 'static and generated exercise actions are wired');
console.log('PASS: ' + ids.length + ' unique static IDs and ' + clickHandlers.length + ' wired click handlers');

const numericInputs = [...html.matchAll(/<input\b[^>]*type="(?:number|range)"[^>]*>/g)].map(x => x[0]);
for (const input of numericInputs) {
  assert.match(input, /\bmin="/, 'numeric control has a minimum: ' + input);
  assert.match(input, /\bmax="/, 'numeric control has a maximum: ' + input);
}
assert.match(html, /id="sessionRpe" type="range" min="1" max="10"/, 'session difficulty slider bounds');
assert.match(html, /id="reviewFatigue" type="range" min="1" max="5"/, 'fatigue slider bounds');
assert.match(html, /id="quickWeight" type="number"[^>]*min="30" max="300"/, 'weigh-in bounds');
assert.match(html, /id="waterOn" type="checkbox"/, 'water checkbox exists');
assert.match(html, /id="trainingOn" type="checkbox"/, 'training reminder checkbox exists');
for (const name of ['saveExerciseResult','startExerciseTimer','pauseExerciseTimer','resetExerciseTimer','startRest','stopRest']) assert.ok(declaredFunctions.has(name), 'exercise control handler ' + name + ' exists');
assert.ok(html.includes("oninput=\"$('sessionRpeValue').textContent=this.value\""), 'session slider updates its visible value');
assert.ok(html.includes("oninput=\"$('reviewFatigueValue').textContent=this.value\""), 'fatigue slider updates its visible value');
assert.ok(html.includes("water:$('waterOn').checked") && html.includes("training:$('trainingOn').checked"), 'checkbox states are saved');
assert.ok(html.includes("$('waterOn').checked=r.water!==false") && html.includes("$('trainingOn').checked=r.training!==false"), 'checkbox states are restored');
assert.match(html, /function saveExerciseResult[\s\S]*?readNumber\('actual-'\+id,1,1000,true,false\)/, 'exercise result is range-checked');
assert.match(html, /function saveProfile[\s\S]*?readNumber\('pAge',13,100/, 'profile age is range-checked');
assert.match(html, /function saveCheckin[\s\S]*?readNumber\('quickWeight',30,300/, 'weigh-in is range-checked');
assert.match(html, /function finishWorkout[\s\S]*?readNumber\('sessionRpe',1,10/, 'session RPE is range-checked');
assert.match(html, /function makeReview[\s\S]*?readNumber\('reviewSessions',0,14/, 'weekly review is range-checked');
console.log('PASS: buttons, generated timer actions, sliders, checkboxes and number constraints');

const js = scriptMatches.map(x => x[1]).join('\n');
const helperStart = js.indexOf('function readNumber(');
const helperEnd = js.indexOf('\nfunction persist(', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'numeric validator exists');
const fields = { n: { value: '1' } };
const context = { $: id => fields[id] };
vm.runInNewContext(js.slice(helperStart, helperEnd) + ';globalThis.readNumber = readNumber;', context);
const check = (value, min, max, integer = true, optional = false) => {
  fields.n.value = value;
  return context.readNumber('n', min, max, integer, optional);
};
assert.equal(check('1', 1, 10).ok, true, 'minimum boundary accepted');
assert.equal(check('10', 1, 10).ok, true, 'maximum boundary accepted');
assert.equal(check('0', 1, 10).ok, false, 'below-minimum rejected');
assert.equal(check('11', 1, 10).ok, false, 'above-maximum rejected');
assert.equal(check('2.5', 1, 10).ok, false, 'fraction rejected for integer control');
assert.equal(check('2.5', 1, 10, false).ok, true, 'decimal accepted for weight');
assert.equal(check('abc', 1, 10).ok, false, 'non-numeric input rejected');
assert.equal(check('', 30, 300, false, true).ok, true, 'optional blank accepted');
assert.equal(check('', 1, 10).ok, false, 'required blank rejected');
console.log('PASS: numeric validator boundary, decimal, blank and invalid-value tests');

const svgStart = html.indexOf('function svgArt(type)');
const svgEnd = html.indexOf('\nfunction renderWorkout()', svgStart);
assert.ok(svgStart >= 0 && svgEnd > svgStart, 'exercise illustration renderer exists');
const svgRenderer = new Function(html.slice(svgStart, svgEnd) + '; return svgArt;')();
for (const type of ['push', 'squat', 'bridge', 'bird', 'scap']) {
  const svg = svgRenderer(type);
  assert.match(svg, /<svg/, type + ' illustration renders SVG');
  assert.match(svg, /fill="url\(#skin\)"/, type + ' illustration includes a recognizable head');
  assert.match(svg, /anim-/, type + ' illustration has its own movement animation');
}
console.log('PASS: five exercise illustrations and movement animations');
