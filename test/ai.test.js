import test from 'node:test';
import assert from 'node:assert/strict';
import { askAI, AI_LIMITS, ENDPOINT } from '../src/ai.js';
import { learningSession } from '../src/learn.js';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const orders = { status: 'completed', line_items: [] };
const config = { orders, model: 'synthetic-model', apiKey: 'synthetic-test-key' };
const response = (text = 'Review payment evidence.') => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'reasoning' }, { type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }] }));

test('AI uses fixed endpoint, explicit model, store false and minimized report only', async () => {
  let calls = 0;
  const result = await askAI({ ...config, orders: { ...orders, billing: { email: 'PRIVATE@example.invalid' }, customer_note: 'PRIVATE', transaction_id: 'PRIVATE' } }, { fetchImpl: async (url, opts) => {
    calls++;
    assert.equal(url, ENDPOINT);
    assert.equal(opts.redirect, 'error');
    assert.equal(opts.headers.Authorization, 'Bearer synthetic-test-key');
    const body = JSON.parse(opts.body);
    assert.equal(body.model, 'synthetic-model');
    assert.equal(body.store, false);
    assert.equal(body.max_output_tokens, 1200);
    assert.deepEqual(body.tools, []);
    assert.ok(!opts.body.includes('PRIVATE'));
    assert.ok(!opts.body.includes('synthetic-test-key'));
    assert.equal(JSON.parse(body.input).orders[0].payment_verification, 'not_performed');
    return response();
  } });
  assert.equal(calls, 1);
  assert.match(result.disclaimer, /Untrusted/);
  assert.equal(result.text, 'Review payment evidence.');
});
test('missing key or model and excessive report never contact a service', async () => {
  const fetchImpl = () => { throw new Error('network should not run'); };
  for (const [extra, code] of [[{ apiKey: '' }, 'AI_KEY_REQUIRED'], [{ model: '' }, 'AI_MODEL_REQUIRED'], [{ model: '../private?key=value' }, 'AI_MODEL_REQUIRED'], [{ orders: Array(1000).fill(orders) }, 'AI_INPUT_TOO_LARGE']]) {
    await assert.rejects(askAI({ ...config, ...extra }, { fetchImpl }), new RegExp('^Error: ' + code + '$'));
  }
});
test('HTTP and network errors have fixed codes, no sensitive remote text', async () => {
  for (const [status, code] of [[401, 'AI_AUTH_FAILED'], [403, 'AI_AUTH_FAILED'], [429, 'AI_RATE_OR_QUOTA_LIMIT'], [500, 'AI_HTTP_FAILED']]) {
    await assert.rejects(askAI(config, { fetchImpl: async () => new Response('PRIVATE remote text', { status }) }), new RegExp('^Error: ' + code + '$'));
  }
  await assert.rejects(askAI(config, { fetchImpl: async () => { throw new Error('PRIVATE secret'); } }), /^Error: AI_REQUEST_FAILED$/);
});
test('incomplete, missing, refusal and malformed responses are rejected', async () => {
  for (const payload of [{ status: 'incomplete', output: [] }, { status: 'failed', output: [] }, null, { status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: 'PRIVATE' }] }] }]) {
    await assert.rejects(askAI(config, { fetchImpl: async () => new Response(JSON.stringify(payload)) }), /AI_INCOMPLETE_OR_INVALID_RESPONSE|AI_NO_TEXT/);
  }
  await assert.rejects(askAI(config, { fetchImpl: async () => new Response('PRIVATE invalid JSON') }), /^Error: AI_INVALID_RESPONSE$/);
});
test('stream response bound stops reads and cancels body', async () => {
  let cancelled = false;
  const body = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(AI_LIMITS.responseBytes + 1)); }, cancel() { cancelled = true; } });
  await assert.rejects(askAI(config, { fetchImpl: async () => new Response(body) }), /^Error: AI_RESPONSE_TOO_LARGE$/);
  assert.equal(cancelled, true);
});
test('timeout bounds connection and body waits without retries', async () => {
  let calls = 0;
  let signal;
  await assert.rejects(askAI(config, { timeoutMs: 10, fetchImpl: async (_, opts) => { calls++; signal = opts.signal; return new Promise(() => {}); } }), /^Error: AI_TIMEOUT$/);
  assert.equal(calls, 1);
  assert.equal(signal.aborted, true);
  await assert.rejects(askAI(config, { timeoutMs: 10, fetchImpl: async (_, opts) => new Response(new ReadableStream({ start(controller) { opts.signal.addEventListener('abort', () => controller.error(new Error('aborted'))); } })) }), /^Error: AI_TIMEOUT$/);
});
test('terminal controls and exact key echoes are removed; text is capped', async () => {
  const result = await askAI(config, { fetchImpl: async () => response('\u001b[31m\u202e' + config.apiKey + ' sk-FAKEKEY ' + 'x'.repeat(15000)) });
  assert.ok(!result.text.includes(config.apiKey));
  assert.ok(!result.text.includes('sk-FAKEKEY'));
  assert.ok(!result.text.includes('\u001b'));
  assert.ok(!result.text.includes('\u202e'));
  assert.ok(result.text.length <= AI_LIMITS.outputCharacters);
});
test('learning tutor asks for lesson, practice and answer key', async () => {
  await askAI({ ...config, learning: true }, { fetchImpl: async (_, opts) => {
    assert.match(JSON.parse(opts.body).instructions, /self-study lesson.*practice questions.*answer key/);
    return response('Lesson');
  } });
  const session = learningSession();
  assert.equal(session.steps.length, 4);
  assert.ok(session.steps.every(x => x.question && x.answer));
  assert.deepEqual(session, learningSession());
});
test('CLI learning works without keys and invalid AI options fail before network', () => {
  const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
  const env = { ...process.env, OPENAI_API_KEY: '' };
  const result = spawnSync(process.execPath, [cli, '--learn', '--format', 'json'], { env, encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).learning_session.mode, 'guided_self_study');
  const missing = spawnSync(process.execPath, [cli, '--learn', '--ai', '--model', 'synthetic-model'], { env, encoding: 'utf8', timeout: 5000 });
  assert.equal(missing.status, 4);
  assert.match(missing.stderr, /AI_KEY_REQUIRED/);
  assert.equal(missing.stdout, '');
  for (const args of [['--learn', '--ai'], ['--learn', '--model', 'synthetic-model'], ['--learn', '--ai', '--api-key', 'NEVER-A-REAL-KEY']]) {
    const bad = spawnSync(process.execPath, [cli, ...args], { env, encoding: 'utf8', timeout: 5000 });
    assert.equal(bad.status, 2);
    assert.ok(!bad.stderr.includes('NEVER-A-REAL-KEY'));
  }
});
test('offline CLI does not call fetch even when an API key is configured', () => {
  const cli = new URL('../src/cli.js', import.meta.url).href;
  const script = `globalThis.fetch = () => { throw new Error('NETWORK_CALLED'); }; process.argv = ['node', 'cli', '--learn']; await import(${JSON.stringify(cli)});`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, OPENAI_API_KEY: 'synthetic-test-key' }, encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /Guided learning/);
});
