const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const code = fs.readFileSync(__dirname + '/pin.js', 'utf8');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
function setup({saved = null, blocked = false} = {}) {
  const elements = Object.fromEntries(['pinGate','guide','pinForm','pinInput','pinSubmit','pinMessage'].map(id => [id, { hidden: id === 'guide', inert: id === 'guide', value: '', textContent: '', handlers: {}, addEventListener(name, fn) { this.handlers[name] = fn; }, focus() { this.focused = true; } }]));
  const scripts = [], storage = new Map(saved ? [['peakpvm-ge-pin-session-v1', saved]] : []);
  const context = { crypto: webcrypto, TextEncoder, Uint8Array,
    document: {getElementById: id => elements[id], createElement: () => ({}), body: {appendChild: script => scripts.push(script)}},
    window: {addEventListener() {}},
    sessionStorage: {getItem(key) {if(blocked) throw Error('blocked'); return storage.get(key);}, setItem(key,value) {if(blocked) throw Error('blocked'); storage.set(key,value);}}
  };
  vm.runInNewContext(code, context);
  return {elements, scripts, storage, async submit(pin) {elements.pinInput.value = pin; let prevented = false; await elements.pinForm.handlers.submit({preventDefault() {prevented=true;}}); assert.ok(prevented);}};
}
(async () => {
  assert.match(html, /<main id="guide"[^>]*hidden inert/);
  assert.match(html, /id="pinInput"[^>]*type="password"[^>]*inputmode="numeric"[^>]*autofocus/);
  assert.match(html, /id="pinSubmit"[^>]*type="submit"/);
  assert.ok(!html.includes('<script src="./app.js'), 'market script must not load before validation');
  const page = setup();
  assert.ok(page.elements.pinInput.focused);
  assert.ok(page.elements.guide.hidden && page.elements.guide.inert);
  assert.equal(page.scripts.length, 0);
  await page.submit('880');
  assert.ok(page.elements.guide.hidden, 'dropping leading zero must not unlock');
  await page.submit('0000');
  assert.match(page.elements.pinMessage.textContent, /Incorrect PIN/);
  assert.ok(page.elements.guide.hidden && page.elements.guide.inert);
  assert.equal(page.scripts.length, 0);
  assert.equal(page.storage.size, 0);
  await page.submit('0880');
  assert.ok(!page.elements.guide.hidden && !page.elements.guide.inert);
  assert.ok(page.elements.pinGate.hidden);
  assert.equal(page.elements.pinInput.value, '');
  assert.equal(page.scripts.length, 1);
  assert.equal(page.storage.get('peakpvm-ge-pin-session-v1'), 'unlocked');
  await page.submit('0880');
  assert.equal(page.scripts.length, 1, 'duplicate submission must not load app twice');
  assert.equal(setup({saved:'unlocked'}).scripts.length, 1, 'tab reload keeps access');
  const withoutStorage = setup({blocked:true});
  await withoutStorage.submit('0880');
  assert.equal(withoutStorage.scripts.length, 1, 'blocked storage must not prevent valid entry');
  console.log('PASS: autofocus; native submit form; locked initial state; wrong PIN; leading zero; successful unlock; single app load; tab session; blocked storage.');
})().catch(error => {console.error(error); process.exitCode=1;});
