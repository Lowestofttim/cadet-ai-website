import test from 'node:test';
import assert from 'node:assert/strict';
import { initUnitRequest } from '../unit-request.mjs';

function page(hash = '#id=11111111-1111-4111-8111-111111111111&action=approve&exp=9999999999&t=' + 'a'.repeat(64)) {
  const elements = Object.fromEntries(['heading','message','unit-name','confirm'].map(id => [id, {
    textContent: '', hidden: id === 'confirm', disabled: false,
    addEventListener(_name, fn) { this.click = fn; },
  }]));
  return { elements, document: { getElementById: id => elements[id] }, location: { hash } };
}
const response = body => ({ ok: true, json: async () => body });

test('a page without a valid email token sends no requests', async () => {
  for (const hash of ['', '#id=hello', '#action=delete']) {
    const p = page(hash);
    let calls = 0;
    await initUnitRequest({ ...p, fetch: async () => { calls++; } });
    assert.equal(calls, 0);
    assert.equal(p.elements.confirm.hidden, true);
    assert.match(p.elements.message.textContent, /email/i);
  }
});

test('loading previews only; explicit confirmation makes one POST and shows email success', async () => {
  const p = page();
  const modes = [];
  await initUnitRequest({ ...p, fetch: async (url, init) => {
    assert.equal(url, 'https://kktwqwppyxerrsusgqsp.supabase.co/functions/v1/unit_request_alert');
    assert.equal(init.method, 'POST');
    const data = JSON.parse(init.body);
    modes.push(data.mode);
    return response({ ok: true, name: '<img src=x>', status: data.mode === 'preview' ? 'pending' : 'approved', notification: 'sent' });
  }});
  assert.deepEqual(modes, ['preview']);
  assert.equal(p.elements['unit-name'].textContent, '<img src=x>');
  assert.equal(p.elements.confirm.hidden, false);
  await Promise.all([p.elements.confirm.click(), p.elements.confirm.click()]);
  assert.deepEqual(modes, ['preview','decide']);
  assert.equal(p.elements.heading.textContent, 'Unit approved');
  assert.match(p.elements.message.textContent, /email.*sent/i);
  assert.equal(p.elements.confirm.hidden, true);
});

test('approval with a pending email offers a retry without saying approval failed', async () => {
  const p = page();
  await initUnitRequest({ ...p, fetch: async (_url, init) => response({
    ok: true, status: JSON.parse(init.body).mode === 'preview' ? 'pending' : 'approved',
    name: 'A unit', notification: 'pending',
  }) });
  await p.elements.confirm.click();
  assert.equal(p.elements.heading.textContent, 'Unit approved');
  assert.match(p.elements.message.textContent, /two minutes/i);
  assert.match(p.elements.confirm.textContent, /email/i);
  assert.equal(p.elements.confirm.disabled, false);
});

test('a lost decision response keeps a retry available without asserting nothing changed', async () => {
  const p = page();
  await initUnitRequest({ ...p, fetch: async (_url, init) => {
    if (JSON.parse(init.body).mode === 'decide') throw Error('network');
    return response({ ok: true, status: 'pending', name: 'A unit' });
  }});
  await p.elements.confirm.click();
  assert.match(p.elements.message.textContent, /check.*result/i);
  assert.equal(p.elements.confirm.disabled, false);
});

test('expired links and conflicting decisions cannot be confirmed', async () => {
  for (const error of ['expired','already_decided']) {
    const p = page();
    await initUnitRequest({ ...p, fetch: async () => ({ ok: false, json: async () => ({ ok: false, error, status: 'rejected' }) }) });
    assert.equal(p.elements.confirm.hidden, true);
    assert.match(p.elements.message.textContent, error === 'expired' ? /expired/i : /already.*rejected/i);
  }
});

test('opening another email in the same tab reloads instead of retaining the old request', async () => {
  const p = page('');
  const listeners = new Map();
  let reloads = 0;
  const previous = { window: globalThis.window, document: globalThis.document };
  globalThis.document = p.document;
  globalThis.window = {
    location: { hash: '', reload: () => reloads++ },
    fetch: async () => { throw Error('unsigned page must not fetch'); },
    addEventListener: (event, fn) => listeners.set(event, fn),
  };
  try {
    await import('../unit-request.mjs?browser-entry-test');
    assert.equal(typeof listeners.get('hashchange'), 'function');
    listeners.get('hashchange')();
    assert.equal(reloads, 1);
  } finally {
    if (previous.window === undefined) delete globalThis.window; else globalThis.window = previous.window;
    if (previous.document === undefined) delete globalThis.document; else globalThis.document = previous.document;
  }
});
