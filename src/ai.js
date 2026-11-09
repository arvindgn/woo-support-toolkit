import { analyze } from './analyze.js';
export const ENDPOINT = 'https://api.openai.com/v1/responses';
export const AI_LIMITS = Object.freeze({ inputBytes: 64 * 1024, responseBytes: 256 * 1024, outputCharacters: 12000, timeoutMs: 30000 });
export const AI_DISCLAIMER = 'Untrusted AI advisory text: may be wrong or invent facts. Verify independently. No actions are executed.';
export class AIError extends Error {
  constructor(code) { super(code); this.code = code; }
}
function safeText(text, key) {
  return text.split(key).join('[REDACTED]').replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED]')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '')
    .slice(0, AI_LIMITS.outputCharacters);
}
async function responseJSON(response) {
  if (!response.body) throw new AIError('AI_INVALID_RESPONSE');
  const reader = response.body.getReader();
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > AI_LIMITS.responseBytes) throw new AIError('AI_RESPONSE_TOO_LARGE');
      chunks.push(value);
    }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); }
    catch { throw new AIError('AI_INVALID_RESPONSE'); }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
// Raw exports are reduced locally by analyze(). No free-text prompts or source fields are sent.
// fetchImpl and timeoutMs are test seams, not CLI settings or supported service overrides.
export async function askAI({ orders, products, model, learning = false, apiKey = process.env.OPENAI_API_KEY }, { fetchImpl = globalThis.fetch, timeoutMs = AI_LIMITS.timeoutMs } = {}) {
  if (typeof apiKey !== 'string' || !/^[\x21-\x7e]{8,512}$/.test(apiKey)) throw new AIError('AI_KEY_REQUIRED');
  if (typeof model !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(model)) throw new AIError('AI_MODEL_REQUIRED');
  const report = analyze(orders, products);
  const input = JSON.stringify(report);
  if (Buffer.byteLength(input) > AI_LIMITS.inputBytes) throw new AIError('AI_INPUT_TOO_LARGE');
  const instructions = 'You are a cautious WooCommerce support educator. The JSON is a minimized offline snapshot, not verified payment or download-permission evidence. Explain possible causes and safe manual checks. Do not invent store facts, request credentials or customer details, provide links or executable commands, or claim to perform actions. ' + (learning ? 'Provide a short guided self-study lesson with three practice questions and an answer key based on the snapshot. This is not persistent chat or model training.' : 'Provide concise educational triage advice.');
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new AIError('AI_TIMEOUT')); }, timeoutMs);
  });
  const request = async () => {
    const response = await fetchImpl(ENDPOINT, {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, instructions, input, store: false, max_output_tokens: 1200, tools: [] })
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new AIError(response.status === 401 || response.status === 403 ? 'AI_AUTH_FAILED' : response.status === 429 ? 'AI_RATE_OR_QUOTA_LIMIT' : 'AI_HTTP_FAILED');
    }
    const data = await responseJSON(response);
    if (!data || data.error != null || data.status !== 'completed' || !Array.isArray(data.output)) throw new AIError('AI_INCOMPLETE_OR_INVALID_RESPONSE');
    const parts = data.output.filter(x => x?.type === 'message' && x.role === 'assistant').flatMap(x => Array.isArray(x.content) ? x.content : []).filter(x => x?.type === 'output_text' && typeof x.text === 'string').map(x => x.text);
    if (!parts.length || !parts.join('').trim()) throw new AIError('AI_NO_TEXT');
    return { disclaimer: AI_DISCLAIMER, text: safeText(parts.join('\n'), apiKey) };
  };
  try { return await Promise.race([request(), timeout]); }
  catch (error) { if (error instanceof AIError) throw error; throw new AIError('AI_REQUEST_FAILED'); }
  finally { clearTimeout(timer); controller.abort(); }
}
