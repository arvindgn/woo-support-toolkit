#!/usr/bin/env node
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { analyze, parseExport, renderText, InputError, LIMITS } from './analyze.js';
import { askAI, AIError } from './ai.js';
import { learningSession, renderLearning, practiceOrders, practiceProducts } from './learn.js';
const HELP = `Usage: node src/cli.js [--orders FILE|-] [--products FILE] [--format json|text]
                      [--learn] [--ai --model MODEL]
Default: offline triage. --orders accepts one order or an array; - reads stdin.
--products supplies product/variation snapshots. Each file is limited to 10 MiB.
--learn adds a guided self-study session. Without --orders, uses synthetic practice data.
--ai explicitly sends the minimized report to OpenAI, using OPENAI_API_KEY from
         your environment. API costs may apply. Review an offline report first.
         --model is required; choose a Responses-compatible model you can access.
         No raw exports are sent. AI advice is untrusted; no actions are executed.
Default format: text. --learn is self-study, not persistent chat or model training.
Exit: 0 success, 2 input/usage error, 3 internal/output error, 4 AI request failure.
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
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!['--orders', '--products', '--format', '--ai', '--model', '--learn'].includes(key) || seen.has(key)) throw new InputError('INVALID_ARGUMENTS');
    seen.add(key);
    if (['--ai', '--learn'].includes(key)) result[key.slice(2)] = true;
    else {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new InputError('INVALID_ARGUMENTS');
      result[key.slice(2)] = args[++i];
    }
  }
  if ((!result.orders && !result.learn) || !['text', 'json'].includes(result.format) || result.products === '-' || (result.products && !result.orders) || (result.ai && !result.model) || (result.model && !result.ai)) throw new InputError('INVALID_ARGUMENTS');
  return result;
}
// Do not print exception messages: parser and filesystem errors may contain private data.
process.stdout.on('error', () => { process.exitCode = 3; });
process.stderr.on('error', () => { process.exitCode = 3; });
try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') process.stdout.write(HELP);
  else if (args.length === 1 && args[0] === '--version') process.stdout.write('0.2.0\n');
  else {
    const opts = options(args);
    const orders = opts.orders ? await readInput(opts.orders) : practiceOrders();
    const products = opts.products ? await readInput(opts.products) : opts.orders ? undefined : practiceProducts();
    const report = analyze(orders, products);
    const session = opts.learn ? learningSession() : undefined;
    let advice;
    if (opts.ai) {
      process.stderr.write('AI opt-in: sending minimized operational report to OpenAI. API costs may apply. Advice is untrusted.\n');
      advice = await askAI({ orders, products, model: opts.model, learning: Boolean(opts.learn) });
    }
    const output = session || advice ? { schema_version: 2, report, ...(session ? { learning_session: session } : {}), ...(advice ? { ai_advice: advice } : {}) } : report;
    process.stdout.write(opts.format === 'json' ? JSON.stringify(output, null, 2) + '\n' : renderText(report) + (session ? renderLearning(session) : '') + (advice ? advice.disclaimer + '\n' + advice.text + '\n' : ''));
  }
} catch (error) {
  const code = error instanceof InputError || error instanceof AIError ? error.code : 'UNEXPECTED_FAILURE';
  process.stderr.write(`Error: ${code}\n`);
  process.exitCode = error instanceof InputError ? 2 : error instanceof AIError ? 4 : 3;
}
