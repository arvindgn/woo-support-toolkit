import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze, parseExport, renderText, LIMITS } from '../src/analyze.js';
const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
const order = (extra = {}) => ({ status: 'processing', line_items: [{ product_id: 10, variation_id: 0 }], ...extra });
const run = (args, input) => spawnSync(process.execPath, [cli, ...args], { input, encoding: 'utf8', timeout: 5000 });

test('reports evidence without claiming verified payment or permission', () => {
  const result = analyze(order({ date_paid: '2026-01-01T12:30:00' }), { id: 10, downloadable: true, downloads: [] });
  const o = result.orders[0];
  assert.equal(o.paid_date, 'recorded');
  assert.equal(o.payment_verification, 'not_performed');
  assert.equal(o.download_permissions, 'not_checked');
  assert.deepEqual(o.items[0].findings, ['NO_DOWNLOAD_FILES_LISTED', 'VERIFY_DOWNLOAD_PERMISSIONS_AND_LIMITS']);
});
test('plain REST orders cannot establish downloadable settings', () => {
  const item = analyze(order()).orders[0].items[0];
  assert.equal(item.downloadable, 'unknown');
  assert.deepEqual(item.findings, ['PRODUCT_SNAPSHOT_MISSING']);
});
test('variation never inherits parent flags; exact variation snapshot resolves', () => {
  const input = order({ line_items: [{ product_id: 10, variation_id: 11 }] });
  assert.equal(analyze(input, { id: 10, downloadable: false }).orders[0].items[0].downloadable, 'unknown');
  assert.equal(analyze(input, { id: 11, downloadable: true, downloads: [{}] }).orders[0].items[0].download_files, 'listed');
});
test('status findings and missing paid evidence are conservative', () => {
  for (const status of ['pending', 'on-hold', 'failed', 'checkout-draft']) assert.ok(analyze(order({ status })).orders[0].findings.includes('PAYMENT_OR_ORDER_REVIEW_NEEDED'));
  for (const status of ['cancelled', 'refunded']) assert.ok(analyze(order({ status })).orders[0].findings.includes('ORDER_NOT_ACTIVE'));
  assert.ok(analyze(order()).orders[0].findings.includes('PAID_DATE_NOT_RECORDED'));
  assert.equal(analyze(order({ date_paid: 'not-a-date' })).orders[0].paid_date, 'not_recorded');
});
test('output is allowlisted even for malicious free text and nested secrets', () => {
  const secret = 'PRIVATE_person@example.invalid_\u001b[31m_https://private.invalid/token';
  const input = order({ status: secret, id: secret, number: secret, customer_note: secret, billing: { email: secret }, transaction_id: secret, meta_data: [{ value: secret }], line_items: [{ name: secret, product_id: 10, variation_id: 0 }] });
  const report = analyze(input, { id: 10, name: secret, downloadable: true, downloads: [{ file: secret, name: secret }] });
  for (const output of [JSON.stringify(report), renderText(report)]) {
    assert.ok(!output.includes(secret));
    assert.ok(!output.includes('example.invalid'));
    assert.ok(!output.includes('\u001b'));
  }
  assert.equal(report.orders[0].status, 'unknown');
});
test('deterministic output and indexes preserve input order without exposing IDs', () => {
  const input = [order({ id: 789 }), order({ id: 456 })];
  assert.deepEqual(analyze(input), analyze(input));
  assert.deepEqual(analyze(input).orders.map(x => x.order_index), [1, 2]);
  assert.ok(!JSON.stringify(analyze(input)).includes('789'));
});
test('rejects malformed shapes, duplicates, and bounded collection sizes', () => {
  for (const input of [null, 3, 'text', [null], {}]) assert.throws(() => analyze(input));
  assert.throws(() => analyze(order({ line_items: [null] })), /INVALID_LINE_ITEMS/);
  assert.throws(() => analyze(order(), [{ id: 10 }, { id: 10 }]), /INVALID_PRODUCT_IDS/);
  assert.throws(() => analyze(Array(LIMITS.orders + 1).fill(order())), /INVALID_ORDERS/);
  assert.throws(() => analyze(order({ line_items: Array(LIMITS.items + 1).fill({}) })), /INVALID_LINE_ITEMS/);
  assert.throws(() => analyze(Array(11).fill(order({ line_items: Array(1000).fill({}) }))), /TOO_MANY_ITEMS/);
  assert.throws(() => parseExport(' '.repeat(LIMITS.bytes + 1)), /INPUT_TOO_LARGE/);
  assert.throws(() => parseExport('{"private":"secret"'), /^Error: INVALID_JSON$/);
});
test('empty export is valid; prototype keys cannot inject report properties', () => {
  assert.equal(analyze([]).order_count, 0);
  assert.equal(analyze(parseExport('{"line_items":[],"__proto__":{"status":"completed"}}')).orders[0].status, 'unknown');
});
test('CLI handles stdin JSON, text, help, version, and invalid options', () => {
  const result = run(['--orders', '-', '--format', 'json'], JSON.stringify(order()));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).order_count, 1);
  assert.match(run(['--orders', '-'], JSON.stringify(order())).stdout, /Order 1: processing/);
  assert.match(run(['--help']).stdout, /Usage:/);
  assert.equal(run(['--version']).stdout, '0.1.0\n');
  for (const args of [[], ['--oops', 'private'], ['--orders', '-', '--format', 'csv'], ['--orders', '-', '--orders', '-']]) assert.equal(run(args).status, 2);
});
test('CLI errors never reflect parse excerpts or filenames', () => {
  for (const result of [run(['--orders', '-'], '{"secret@example.invalid":'), run(['--orders', '/private/customer@example.invalid'])]) {
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.ok(!result.stderr.includes('example.invalid'));
    assert.match(result.stderr, /^Error: [A-Z_]+\n$/);
  }
});
test('CLI reads files and catalog; rejects oversized files, directories, invalid UTF-8', () => {
  const dir = mkdtempSync(join(tmpdir(), 'woo-support-test-'));
  try {
    const orders = join(dir, 'orders.json');
    const products = join(dir, 'products.json');
    writeFileSync(orders, JSON.stringify(order()));
    writeFileSync(products, JSON.stringify([{ id: 10, downloadable: false }]));
    const result = run(['--orders', orders, '--products', products, '--format', 'json']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).orders[0].items[0].downloadable, 'no');
    assert.match(run(['--orders', dir]).stderr, /INPUT_MUST_BE_REGULAR_FILE/);
    writeFileSync(orders, Buffer.from([0xff]));
    assert.match(run(['--orders', orders]).stderr, /INVALID_UTF8/);
    writeFileSync(orders, ' '.repeat(LIMITS.bytes + 1));
    assert.match(run(['--orders', orders]).stderr, /INPUT_TOO_LARGE/);
    assert.match(run(['--orders', '-'], ' '.repeat(LIMITS.bytes + 1)).stderr, /INPUT_TOO_LARGE/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('invalid calendar dates and time components never imply paid-date evidence', () => {
  for (const date of ['2026-02-30T12:00:00', '2026-02-29T12:00:00', '0000-01-01T00:00:00', '2026-01-01T24:00:00', '2026-01-01T00:60:00', '2026-01-01T00:00:60', '2026-01-01T00:00:00+14:01']) {
    assert.equal(analyze(order({ date_paid: date })).orders[0].paid_date, 'not_recorded', date);
  }
  assert.equal(analyze(order({ date_paid: '2024-02-29T00:00:00Z' })).orders[0].paid_date, 'recorded');
});
