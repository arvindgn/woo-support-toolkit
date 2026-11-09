#!/usr/bin/env node
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { analyze, parseExport, renderText, InputError, LIMITS } from './analyze.js';
const HELP = `Usage: node src/cli.js --orders FILE|- [--products FILE] [--format json|text]
Offline WooCommerce REST JSON export triage. No network requests or store changes.
--orders accepts one order or an array. - reads stdin.
--products optionally supplies product/variation objects, one or an array.
Default format: text. Each file is limited to 10 MiB.
Exit codes: 0 report generated, 2 input/usage error, 3 unexpected failure.
Findings do not change the exit code. Use --help or --version alone.
`;
async function readInput(path) {
  let file;
  let stream;
  try {
    if (path === '-') stream = process.stdin;
    else {
      file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
      const stat = await file.stat();
      if (!stat.isFile()) throw new InputError('INPUT_MUST_BE_REGULAR_FILE');
      if (stat.size > LIMITS.bytes) throw new InputError('INPUT_TOO_LARGE');
      stream = file.createReadStream({ autoClose: false });
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of stream) {
      size += chunk.length;
      if (size > LIMITS.bytes) throw new InputError('INPUT_TOO_LARGE');
      chunks.push(chunk);
    }
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)); }
    catch { throw new InputError('INVALID_UTF8'); }
    return parseExport(text);
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError('INPUT_READ_FAILED');
  } finally { if (file) await file.close(); }
}
function options(args) {
  const result = { format: 'text' };
  const seen = new Set();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    if (!['--orders', '--products', '--format'].includes(key) || seen.has(key) || !args[i + 1]) throw new InputError('INVALID_ARGUMENTS');
    seen.add(key);
    result[key.slice(2)] = args[i + 1];
  }
  if (!result.orders || !['text', 'json'].includes(result.format) || result.products === '-') throw new InputError('INVALID_ARGUMENTS');
  return result;
}
// Do not print exception messages: parser and filesystem errors may contain private data.
process.stdout.on('error', () => { process.exitCode = 3; });
process.stderr.on('error', () => { process.exitCode = 3; });
try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') process.stdout.write(HELP);
  else if (args.length === 1 && args[0] === '--version') process.stdout.write('0.1.0\n');
  else {
    const opts = options(args);
    const orders = await readInput(opts.orders);
    const products = opts.products ? await readInput(opts.products) : undefined;
    const report = analyze(orders, products);
    process.stdout.write(opts.format === 'json' ? JSON.stringify(report, null, 2) + '\n' : renderText(report));
  }
} catch (error) {
  const code = error instanceof InputError ? error.code : 'UNEXPECTED_FAILURE';
  process.stderr.write(`Error: ${code}\n`);
  process.exitCode = error instanceof InputError ? 2 : 3;
}
