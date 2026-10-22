import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

const source = stripTypeScriptTypes(readFileSync(new URL('../src/utils/audioAlert.ts', import.meta.url), 'utf8'));
const exported = [...source.matchAll(/^export (?:async )?(?:function|const) (\w+)/gm)].map(match => match[1]);
const compiled = source.replace(/^export /gm, '') + `\nmodule.exports = {${exported.join(',')}};`;
const flush = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };
function storage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
}
function lockManager() {
  const held = new Set();
  const queue = [];
  function drain() {
    for (const request of [...queue]) {
      if (held.has(request.key)) continue;
      queue.splice(queue.indexOf(request), 1);
      held.add(request.key);
      Promise.resolve(request.callback()).then(() => {
        held.delete(request.key);
        request.resolve();
        drain();
      });
    }
  }
  return { request: (key, options, callback) => new Promise((resolve, reject) => {
    const entry = { key, callback, resolve };
    queue.push(entry);
    options.signal.addEventListener('abort', () => {
      const index = queue.indexOf(entry);
      if (index < 0) return;
      queue.splice(index, 1);
      reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    });
    drain();
  }) };
}
let token = 0;
function browser({ sharedStorage = storage(), locks, focused = true } = {}) {
  let now = 1000000;
  const timers = new Map();
  const nodes = [];
  const contexts = [];
  const parameter = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  class AudioContext {
    state = 'suspended';
    destination = {};
    resumeCalls = 0;
    constructor() { contexts.push(this); }
    get currentTime() { return now / 1000; }
    async resume() { this.resumeCalls++; this.state = 'running'; }
    createGain() { return { gain: parameter(), connect() {}, disconnect() {} }; }
    createOscillator() {
      const node = { frequency: parameter(), connect() {}, disconnect() {}, start() {}, stop() { this.stopped = true; } };
      nodes.push(node);
      return node;
    }
  }
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, console, AbortController,
    Date: class extends Date { static now() { return now; } },
    Event: class {}, window: { AudioContext, dispatchEvent() {} }, navigator: { locks },
    document: { hasFocus: () => focused }, crypto: { randomUUID: () => `tab-${++token}` }, localStorage: sharedStorage,
    setInterval(callback, delay) { const id = ++token; timers.set(id, { callback, delay }); return id; },
    clearInterval(id) { timers.delete(id); },
  });
  return {
    api: module.exports, nodes, contexts, timers,
    tick(ms) { now += ms; for (const { callback } of [...timers.values()]) callback(); },
  };
}

test('audio inspection and waiting never resume audio without an explicit unlock', async () => {
  const tab = browser({ locks: lockManager() });
  assert.equal(tab.api.getAudioContextState(), 'suspended');
  assert.equal(tab.contexts.length, 0);
  tab.api.startOrderAlertLoop();
  assert.equal(tab.nodes.length, 0);
  assert.equal(tab.contexts[0].resumeCalls, 0);
  tab.api.stopOrderAlertLoop();
  assert.equal(await tab.api.unlockAudio(), true);
  assert.equal(tab.contexts[0].resumeCalls, 1);
});

test('one persistent loop, no overlapping strikes, and immediate cancellation', async () => {
  const tab = browser({ locks: lockManager() });
  await tab.api.unlockAudio();
  tab.api.startOrderAlertLoop(7000, 'store-a');
  const firstStrike = tab.nodes.length;
  assert.ok(firstStrike > 0);
  tab.api.startOrderAlertLoop(7000, 'store-a');
  tab.api.playNewOrderSound();
  assert.equal(tab.nodes.length, firstStrike);
  assert.equal(tab.timers.size, 1);
  assert.equal([...tab.timers.values()][0].delay, 7000);
  tab.tick(7000);
  assert.equal(tab.nodes.length, firstStrike * 2);
  tab.api.stopOrderAlertLoop();
  assert.equal(tab.timers.size, 0);
  assert.equal(tab.api.isOrderAlertLoopActive(), false);
  assert.ok(tab.nodes.every(node => node.stopped));
  tab.tick(7000);
  assert.equal(tab.nodes.length, firstStrike * 2);
});

test('temporary silence cancels current sound and expires automatically after five minutes', async () => {
  const sharedStorage = storage();
  const tab = browser({ sharedStorage, locks: lockManager() });
  const otherTab = browser({ sharedStorage });
  await tab.api.unlockAudio();
  tab.api.startOrderAlertLoop();
  const firstStrike = tab.nodes.length;
  tab.api.muteOrderSoundTemporarily();
  assert.equal(tab.api.isOrderSoundMuted(), true);
  assert.equal(otherTab.api.isOrderSoundMuted(), true);
  assert.ok(tab.nodes.every(node => node.stopped));
  tab.tick(7000);
  assert.equal(tab.nodes.length, firstStrike);
  tab.tick(300000);
  assert.equal(tab.api.isOrderSoundMuted(), false);
  assert.equal(tab.nodes.length, firstStrike * 2);
  tab.api.stopOrderAlertLoop();
});

test('Web Locks elects one audible tab and transfers ownership when it stops', async () => {
  const sharedStorage = storage();
  const locks = lockManager();
  const first = browser({ sharedStorage, locks });
  const second = browser({ sharedStorage, locks });
  await first.api.unlockAudio();
  await second.api.unlockAudio();
  first.api.startOrderAlertLoop(7000, 'same-store');
  second.api.startOrderAlertLoop(7000, 'same-store');
  assert.ok(first.nodes.length > 0);
  assert.equal(second.nodes.length, 0);
  first.api.stopOrderAlertLoop();
  await flush();
  assert.ok(second.nodes.length > 0);
  assert.equal(second.timers.size, 1);
  second.api.stopOrderAlertLoop();
});

test('lease fallback prevents duplicated sound and lets another tab take over', async () => {
  const sharedStorage = storage();
  const first = browser({ sharedStorage });
  const second = browser({ sharedStorage });
  await first.api.unlockAudio();
  await second.api.unlockAudio();
  first.api.startOrderAlertLoop(7000, 'same-store');
  second.api.startOrderAlertLoop(7000, 'same-store');
  first.tick(1000);
  second.tick(1000);
  assert.ok(first.nodes.length > 0);
  assert.equal(second.nodes.length, 0);
  first.api.stopOrderAlertLoop();
  second.tick(1000);
  assert.equal(second.nodes.length, 0);
  second.tick(1000);
  assert.ok(second.nodes.length > 0);
  second.api.stopOrderAlertLoop();
});

test('with storage blocked, fallback produces audio only in a focused tab', async () => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } };
  const background = browser({ sharedStorage: blocked, focused: false });
  await background.api.unlockAudio();
  background.api.startOrderAlertLoop();
  background.tick(1000);
  assert.equal(background.nodes.length, 0);
  background.api.stopOrderAlertLoop();
  const foreground = browser({ sharedStorage: blocked, focused: true });
  await foreground.api.unlockAudio();
  foreground.api.startOrderAlertLoop();
  assert.ok(foreground.nodes.length > 0);
  foreground.api.muteOrderSoundTemporarily();
  assert.equal(foreground.api.isOrderSoundMuted(), true);
  foreground.api.stopOrderAlertLoop();
});
