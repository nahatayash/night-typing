const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const source = fs.readFileSync('app.js', 'utf8');

function setup(t, words = ['cat', 'dog', 'sun']) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.eval(source + `\nwindow.testState = { seed(words) { targetWords=words; typedWords=['']; render(true); }, read() { return JSON.stringify(typedWords); } };`);
  w.testState.seed(words);
  const query = selector => w.document.querySelector(selector);
  function key(value, options = {}) {
    const event = new w.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options });
    w.document.activeElement.dispatchEvent(event);
    return event;
  }
  const type = text => [...text].forEach(ch => key(ch));
  const state = () => JSON.parse(w.testState.read());
  return { w, key, type, query, state };
}

test('wrong letters do not block input, extra letters are visible, Space commits errors', t => {
  const { type, query, state } = setup(t);
  type('cxtzz');
  assert.deepEqual(state(), ['cxtzz']);
  assert.equal(query('.word.current').textContent, 'catzz');
  assert.equal(query('.word.current').querySelectorAll('.extra').length, 2);
  assert.equal(query('.word.current').querySelectorAll('.incorrect').length, 3);
  type(' dog');
  assert.deepEqual(state(), ['cxtzz', 'dog']);
  assert.equal(query('.word.error').textContent, 'catzz');
  assert.equal(query('.word.current').querySelectorAll('.correct').length, 3);
});

test('extra characters move the caret past the actual typed character', t => {
  const { w, type, query } = setup(t);
  type('catxyz');
  const last = query('.word.current').lastElementChild;
  last.getBoundingClientRect = () => ({ left: 70, right: 80, top: 20, height: 30 });
  query('#wordArea').getBoundingClientRect = () => ({ left: 10, top: 10 });
  w.eval('placeCaret()');
  assert.equal(last.textContent, 'z');
  assert.equal(query('#caret').style.transform, 'translate3d(70px,13px,0)');
});

test('Backspace removes visible extras and restores the expected letter after a typo', t => {
  const { type, key, query, state } = setup(t);
  type('cxtzz');
  key('Backspace'); key('Backspace');
  assert.equal(query('.word.current').querySelectorAll('.extra').length, 0);
  key('Backspace'); key('Backspace');
  type('at');
  assert.deepEqual(state(), ['cat']);
  assert.equal(query('.word.current').querySelectorAll('.incorrect').length, 0);
  assert.equal(query('.word.current').querySelectorAll('.correct').length, 3);
});

test('short words mark omitted letters and repeated spaces do not skip the next word', t => {
  const { type, query, state } = setup(t);
  type('c  dog');
  assert.deepEqual(state(), ['c', 'dog']);
  assert.equal(query('.word.error').querySelectorAll('.missed').length, 2);
  assert.equal(query('.word.current').textContent, 'dog');
});

test('Backspace crosses a word boundary and preserves the previous input', t => {
  const { type, key, state, query } = setup(t);
  type('catx '); key('Backspace');
  assert.deepEqual(state(), ['catx']);
  assert.equal(query('.word.current .extra').textContent, 'x');
  key('Backspace'); type(' dog');
  assert.deepEqual(state(), ['cat', 'dog']);
  assert.equal(query('.word.error'), null);
});

test('fast mixed input is recorded once per key and existing word nodes survive', t => {
  const { type, query, state } = setup(t);
  const node = query('.word');
  const text = 'cabxx badq dogzz sunxx';
  type(text);
  assert.deepEqual(state(), text.split(' '));
  assert.equal(query('.word'), node);
});

test('the first key is retained when the passage has focus', t => {
  const { type, query, state } = setup(t);
  query('#wordArea').focus();
  type('cat');
  assert.deepEqual(state(), ['cat']);
});

test('caret uses content coordinates when the passage has scrolled', t => {
  const { w, query } = setup(t);
  const area = query('#wordArea');
  area.scrollTop = 100;
  area.getBoundingClientRect = () => ({ left: 10, top: 200 });
  query('.word .char').getBoundingClientRect = () => ({ left: 50, right: 60, top: 230, height: 30 });
  w.eval('placeCaret()');
  assert.equal(query('#caret').style.transform, 'translate3d(40px,133px,0)');
});

test('restarting resets scrolled content and all error state', t => {
  const { w, type, query, state } = setup(t);
  type('xxxxx ');
  query('#wordArea').scrollTop = 100;
  w.eval('init()');
  assert.equal(query('#wordArea').scrollTop, 0);
  assert.deepEqual(state(), ['']);
  assert.equal(query('.extra'), null);
  assert.equal(query('.word.error'), null);
});

test('the last generated word is followed by more words, never a dead end', t => {
  const { type, state, query } = setup(t, ['cat']);
  type('bad dog');
  assert.deepEqual(state(), ['bad', 'dog']);
  assert.ok(query('.word.current'));
});
