import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const envPath = resolve(root, '.env.local');
if (existsSync(envPath)) process.loadEnvFile(envPath);
const key = process.env.NEAR_AI_API_KEY;
if (!key) throw new Error('NEAR_AI_API_KEY is absent. Set it in the ignored root .env.local.');
const endpoint = 'https://cloud-api.near.ai/v1';
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const catalogResponse = await fetch(`${endpoint}/models`, { headers, signal: AbortSignal.timeout(20000) });
if (!catalogResponse.ok) throw new Error(`Model catalog returned HTTP ${catalogResponse.status}; credentials are not printed.`);
const catalog = await catalogResponse.json();
const models = (catalog.data ?? []).map(({ id, pricing, context_length, max_output_tokens, architecture }) => ({ id, pricing, context_length, max_output_tokens, architecture }));
const smoke = process.argv.includes('--smoke');
if (!smoke) {
  const chosen = process.env.NEAR_AI_MODEL;
  const textModels = models.filter(m => m.architecture?.outputModalities?.includes('text'));
  console.log(JSON.stringify({ endpoint, keyPresent: true, catalogStatus: catalogResponse.status, modelCount: models.length, models: chosen ? models.filter(m => m.id === chosen) : textModels.map(m => ({ id: m.id, pricing: m.pricing })).slice(0, 12) }, null, 2));
} else {
  const model = process.env.NEAR_AI_MODEL;
  if (!model || !models.some(m => m.id === model)) throw new Error('Set NEAR_AI_MODEL to an exact accessible catalog ID before running --smoke.');
  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST', headers, signal: AbortSignal.timeout(90000),
    body: JSON.stringify({ model, max_tokens: 128, temperature: 0, messages: [{ role: 'user', content: 'Reply with exactly: PROOFBOUND READY' }] }),
  });
  if (!response.ok) throw new Error(`Live inference returned HTTP ${response.status}; response body and credentials are not printed.`);
  const result = await response.json();
  const evidence = { checkedAt: new Date().toISOString(), endpoint, model, requestId: response.headers.get('x-request-id') ?? result.id, status: response.status, usage: result.usage, output: result.choices?.[0]?.message?.content, finishReason: result.choices?.[0]?.finish_reason, catalogPricing: models.find(m => m.id === model)?.pricing, note: 'Single capped live NEAR AI request. Provider credits are external to testnet Fuel. No secrets in this receipt.' };
  if (!evidence.output?.includes('PROOFBOUND READY')) throw new Error('Provider did not return the expected smoke-test text. No success receipt saved.');
  mkdirSync(resolve(root, 'docs/evidence'), { recursive: true });
  writeFileSync(resolve(root, 'docs/evidence/near-ai-smoke.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
}
