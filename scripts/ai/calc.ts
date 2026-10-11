/**
 * Parametric question generators: same idea, fresh numbers every time. Each returns a question whose wrong options are
 * the classic slips (forgot the overlap, mixed up bits and bytes, used the wrong operator).
 */
import type { Rng } from "./rng";

export type CalcQ = { prompt: string; right: string; wrong: string[]; diff: number; why: string };
type Gen = (r: Rng) => CalcQ;

const n = (x: number) => (Math.abs(x) >= 1000 ? x.toLocaleString("en-US") : String(x));
const f = (x: number, d = 2) => String(+x.toFixed(d));
const usd = (x: number) => "$" + (x < 1 ? x.toFixed(4).replace(/0+$/, "").replace(/\.$/, ".00") : x.toFixed(2));
/** unique plausible wrong numbers around the right one */
function near(r: Rng, right: number, extra: number[], fmt: (x: number) => string, count = 3): string[] {
  const out = new Set<string>();
  const rs = fmt(right);
  for (const e of extra) if (Number.isFinite(e) && fmt(e) !== rs) out.add(fmt(e));
  let guard = 0;
  while (out.size < count && guard++ < 50) {
    const v = right * r.pick([0.5, 0.75, 1.25, 1.5, 2, 0.1, 10]) + r.pick([0, 1, -1, 2]);
    if (v > 0 && fmt(v) !== rs) out.add(fmt(v));
  }
  return [...out].slice(0, count);
}

export const CALC: Record<string, Gen> = {
  tokens_words(r) {
    const w = r.pick([300, 450, 600, 750, 900, 1200, 1500, 3000, 6000, 7500]);
    const t = Math.round(w / 0.75);
    return { prompt: `Rule of thumb: one token is about 0.75 English words. Roughly how many tokens is a ${n(w)}-word document?`,
      right: `about ${n(t)}`, wrong: near(r, t, [w * 0.75, w, w * 2], (x) => `about ${n(Math.round(x))}`), diff: 1,
      why: `tokens = words / 0.75 = ${n(w)} / 0.75 ≈ ${n(t)} (a token is shorter than a word, so there are more tokens than words).` };
  },
  ctx_budget(r) {
    const win = r.pick([8000, 16000, 32000, 128000]), sys = r.pick([500, 800, 1200]), reply = r.pick([1000, 2000, 4000]), q = r.pick([100, 200, 300]);
    const left = win - sys - reply - q;
    return { prompt: `A model has a ${n(win)}-token context window. Your system prompt uses ${n(sys)} tokens, the user question ${n(q)}, and you reserve ${n(reply)} for the reply. How many tokens remain for retrieved documents?`,
      right: n(left), wrong: near(r, left, [win - sys - q, win - reply - q, win - sys - reply], n), diff: 2,
      why: `The window covers input and output: ${n(win)} − ${n(sys)} − ${n(q)} − ${n(reply)} = ${n(left)}.` };
  },
  api_cost(r) {
    const pin = r.pick([1, 2, 3, 5]), pout = r.pick([4, 6, 10, 15]), i = r.pick([2000, 5000, 12000, 50000]), o = r.pick([500, 1000, 2000, 4000]);
    const c = (i * pin + o * pout) / 1e6;
    return { prompt: `A hypothetical model costs $${pin} per million input tokens and $${pout} per million output tokens. A request sends ${n(i)} input tokens and receives ${n(o)} output tokens. What does it cost?`,
      right: usd(c), wrong: near(r, c, [(i + o) * pin / 1e6, (i + o) * pout / 1e6, (i * pout + o * pin) / 1e6], usd), diff: 2,
      why: `(${n(i)}×$${pin} + ${n(o)}×$${pout}) / 1,000,000 = ${usd(c)}. Input and output are priced separately.` };
  },
  api_cost_batch(r) {
    const pin = r.pick([1, 2, 3]), pout = r.pick([4, 8, 12]), i = r.pick([1000, 3000]), o = r.pick([200, 500]), reqs = r.pick([1000, 5000, 20000]), disc = r.pick([50, 25]);
    const full = reqs * (i * pin + o * pout) / 1e6, c = full * (1 - disc / 100);
    return { prompt: `A hypothetical model costs $${pin}/M input and $${pout}/M output tokens. A batch job runs ${n(reqs)} requests of ${n(i)} input and ${n(o)} output tokens each, and the batch tier gives a ${disc}% discount. What is the total?`,
      right: usd(c), wrong: near(r, c, [full, full * disc / 100, full * (1 + disc / 100)], usd), diff: 3,
      why: `Full price = ${n(reqs)}×(${n(i)}×$${pin}+${n(o)}×$${pout})/1M = ${usd(full)}; after the ${disc}% discount = ${usd(c)}.` };
  },
  rate_limit(r) {
    const rpm = r.pick([20, 50, 60, 100, 500]), tot = rpm * r.pick([3, 4, 7, 12]) + r.pick([1, 7, 13]);
    const m = Math.ceil(tot / rpm);
    return { prompt: `An API allows ${rpm} requests per minute. What is the minimum whole number of minutes to send ${n(tot)} requests?`,
      right: `${m} minutes`, wrong: near(r, m, [Math.floor(tot / rpm), m + 1, tot / 10], (x) => `${Math.max(1, Math.round(x))} minutes`), diff: 2,
      why: `ceil(${n(tot)} / ${rpm}) = ${m}; a partial last minute still counts.` };
  },
  backoff(r) {
    const base = r.pick([1, 2, 0.5]), k = r.pick([4, 5, 6]);
    const d = base * 2 ** (k - 1);
    return { prompt: `A client retries with exponential backoff: the first retry waits ${base}s and each later wait doubles. How long is the wait before retry number ${k}?`,
      right: `${d}s`, wrong: near(r, d, [base * k, base * 2 ** k, base * 2 ** (k - 2)], (x) => `${f(x)}s`), diff: 2,
      why: `wait = ${base} × 2^(${k}−1) = ${d}s.` };
  },
  throughput(r) {
    const tok = r.pick([400, 600, 900, 1500]), tps = r.pick([20, 30, 50, 75]), ttft = r.pick([0.5, 1, 2]);
    const t = ttft + tok / tps;
    return { prompt: `A model has a ${ttft}s time-to-first-token and then streams ${tps} tokens per second. About how long until a ${n(tok)}-token reply has fully arrived?`,
      right: `${f(t)}s`, wrong: near(r, t, [tok / tps, ttft * tok / tps, ttft + tok * tps / 100], (x) => `${f(x)}s`), diff: 2,
      why: `total = TTFT + tokens / rate = ${ttft} + ${tok}/${tps} = ${f(t)}s.` };
  },
  chunk_count(r) {
    const N = r.pick([2000, 5000, 10000, 24000]), C = r.pick([500, 800, 1000]), O = r.pick([50, 100, 200]);
    const k = Math.ceil((N - O) / (C - O));
    return { prompt: `A ${n(N)}-token document is split into chunks of ${C} tokens with ${O} tokens of overlap between consecutive chunks. How many chunks result?`,
      right: String(k), wrong: near(r, k, [Math.ceil(N / C), Math.ceil(N / (C - O)) + 1, Math.floor(N / C)], String), diff: 3,
      why: `Each new chunk advances ${C - O} tokens: ceil((${n(N)} − ${O}) / ${C - O}) = ${k}.` };
  },
  chunk_stride(r) {
    const C = r.pick([256, 512, 1024]), pct = r.pick([10, 20, 25]);
    const O = (C * pct) / 100, s = C - O;
    return { prompt: `Chunks are ${C} tokens long with ${pct}% overlap. By how many tokens does each chunk start after the previous one?`,
      right: String(s), wrong: near(r, s, [O, C, C + O], String), diff: 2, why: `overlap = ${O}, stride = ${C} − ${O} = ${s}.` };
  },
  precision_recall(r) {
    const tp = r.int(3, 9), fp = r.int(1, 6), fn = r.int(1, 6);
    const p = tp / (tp + fp), rc = tp / (tp + fn);
    const ask = r.pick(["precision", "recall"] as const);
    const v = ask === "precision" ? p : rc;
    return { prompt: `A retriever returns ${tp + fp} chunks; ${tp} are relevant. There are ${tp + fn} relevant chunks in the whole index. What is its ${ask}?`,
      right: f(v), wrong: near(r, v, [ask === "precision" ? rc : p, tp / (tp + fp + fn), (p + rc) / 2], f), diff: 3,
      why: `precision = TP/(TP+FP) = ${tp}/${tp + fp}; recall = TP/(TP+FN) = ${tp}/${tp + fn}.` };
  },
  f1(r) {
    const tp = r.pick([6, 8, 12, 16]), fp = r.pick([2, 4]), fn = r.pick([2, 4, 8]);
    const p = tp / (tp + fp), rc = tp / (tp + fn), f1 = (2 * p * rc) / (p + rc);
    return { prompt: `A classifier has ${tp} true positives, ${fp} false positives and ${fn} false negatives. What is its F1 score (2 d.p.)?`,
      right: f(f1), wrong: near(r, f1, [p, rc, (p + rc) / 2], f), diff: 4, why: `F1 = 2PR/(P+R) = 2TP/(2TP+FP+FN) = ${f(f1)}.` };
  },
  accuracy(r) {
    const tp = r.int(20, 60), tn = r.int(20, 60), fp = r.int(2, 15), fn = r.int(2, 15);
    const a = ((tp + tn) / (tp + tn + fp + fn)) * 100;
    return { prompt: `A model's confusion matrix shows TP=${tp}, TN=${tn}, FP=${fp}, FN=${fn}. What is its accuracy?`,
      right: `${f(a, 1)}%`, wrong: near(r, a, [(tp / (tp + fp)) * 100, (tp / (tp + fn)) * 100, ((tp + tn) / (tp + tn + fp)) * 100], (x) => `${f(x, 1)}%`), diff: 2,
      why: `accuracy = (TP+TN)/all = ${tp + tn}/${tp + tn + fp + fn}.` };
  },
  mrr(r) {
    const ranks = [r.pick([1, 2]), r.pick([1, 3, 4]), r.pick([2, 4, 5])];
    const m = ranks.reduce((s, x) => s + 1 / x, 0) / ranks.length;
    return { prompt: `For three queries the first relevant result appeared at ranks ${ranks.join(", ")}. What is the mean reciprocal rank (MRR, 2 d.p.)?`,
      right: f(m), wrong: near(r, m, [ranks.reduce((s, x) => s + x, 0) / 3, 1 / (ranks.reduce((s, x) => s + x, 0) / 3), 1 / Math.min(...ranks)], f), diff: 4,
      why: `MRR = mean(1/rank) = (${ranks.map((x) => `1/${x}`).join(" + ")}) / 3 = ${f(m)}.` };
  },
  cosine(r) {
    const trip = r.pick([[3, 4, 4, 3, 24, 25], [1, 0, 0, 1, 0, 1], [2, 0, 4, 0, 1, 1], [1, 2, 2, 4, 1, 1], [3, 4, 6, 8, 1, 1], [1, 0, -1, 0, -1, 1]]);
    const [a1, a2, b1, b2, num, den] = trip;
    const c = num / den;
    return { prompt: `What is the cosine similarity of the vectors (${a1}, ${a2}) and (${b1}, ${b2})?`,
      right: f(c), wrong: near(r, c, [(a1 * b1 + a2 * b2), -c, 0.5], f), diff: 3,
      why: `dot / (|a||b|) = ${a1 * b1 + a2 * b2} / (${f(Math.hypot(a1, a2))} × ${f(Math.hypot(b1, b2))}) = ${f(c)}.` };
  },
  l2(r) {
    const t = r.pick([[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17]]);
    const [dx, dy, d] = t;
    return { prompt: `Two 2-D embeddings differ by ${dx} on one axis and ${dy} on the other. What is their Euclidean (L2) distance?`,
      right: String(d), wrong: near(r, d, [dx + dy, dx * dy, d * d], String), diff: 2, why: `sqrt(${dx}² + ${dy}²) = ${d}.` };
  },
  emb_storage(r) {
    const N = r.pick([1e5, 1e6, 5e6, 1e7]), d = r.pick([384, 768, 1024, 1536]);
    const gb = (N * d * 4) / 1e9;
    return { prompt: `You store ${n(N)} embeddings of ${n(d)} dimensions as 32-bit floats (4 bytes each). About how much raw vector storage is that, ignoring index overhead and metadata?`,
      right: `${f(gb, gb < 1 ? 2 : 1)} GB`, wrong: near(r, gb, [gb / 4, gb * 2, gb / 8], (x) => `${f(x, x < 1 ? 2 : 1)} GB`), diff: 3,
      why: `${n(N)} × ${n(d)} × 4 bytes = ${f(gb, 2)} GB.` };
  },
  model_memory(r) {
    const B = r.pick([1, 3, 7, 8, 13, 34, 70]), prec = r.pick([["32-bit float", 4], ["16-bit float", 2], ["8-bit integer", 1], ["4-bit integer", 0.5]] as [string, number][]);
    const gb = B * prec[1];
    return { prompt: `Roughly how much memory do the weights of a ${B}-billion-parameter model need when stored as ${prec[0]} values (ignore activations and the KV cache)?`,
      right: `about ${f(gb, 1)} GB`, wrong: near(r, gb, [B * 4, B * 2, B / 2, B * 8 / 2], (x) => `about ${f(x, 1)} GB`), diff: 3,
      why: `${B}B parameters × ${prec[1]} bytes = ${f(gb, 1)} GB.` };
  },
  lora_params(r) {
    const d = r.pick([768, 1024, 4096]), k = r.pick([768, 1024, 4096]), rk = r.pick([4, 8, 16, 32]);
    const full = d * k, lora = rk * (d + k);
    return { prompt: `A ${n(d)} × ${n(k)} weight matrix is adapted with LoRA at rank ${rk}. How many trainable parameters does that adapter add (A and B together)?`,
      right: n(lora), wrong: near(r, lora, [full, rk * d, rk * rk * 2], n), diff: 4,
      why: `B is ${n(d)}×${rk} and A is ${rk}×${n(k)}: ${rk}×(${n(d)}+${n(k)}) = ${n(lora)}, versus ${n(full)} for the full matrix.` };
  },
  train_steps(r) {
    const N = r.pick([10000, 25000, 50000, 120000]), B = r.pick([16, 32, 64, 128]), E = r.pick([2, 3, 5, 10]);
    const steps = Math.ceil(N / B) * E;
    return { prompt: `You train on ${n(N)} examples with a batch size of ${B} for ${E} epochs. How many optimizer steps happen in total?`,
      right: n(steps), wrong: near(r, steps, [Math.ceil(N / B), N * E, Math.ceil(N / (B * E))], n), diff: 2,
      why: `ceil(${n(N)}/${B}) = ${n(Math.ceil(N / B))} steps per epoch × ${E} epochs.` };
  },
  grad_accum(r) {
    const micro = r.pick([2, 4, 8]), acc = r.pick([4, 8, 16]), gpus = r.pick([1, 2, 4, 8]);
    const eff = micro * acc * gpus;
    return { prompt: `Each GPU processes a micro-batch of ${micro}, gradients are accumulated over ${acc} steps, on ${gpus} GPU${gpus > 1 ? "s" : ""}. What is the effective batch size per optimizer update?`,
      right: String(eff), wrong: near(r, eff, [micro * acc, micro * gpus, acc * gpus], String), diff: 3, why: `${micro} × ${acc} × ${gpus} = ${eff}.` };
  },
  lr_decay(r) {
    const lr = r.pick([0.1, 0.01, 0.001]), g = r.pick([0.5, 0.9]), e = r.pick([2, 3, 4]);
    const v = lr * g ** e;
    return { prompt: `The learning rate starts at ${lr} and is multiplied by ${g} after every epoch (exponential decay). What is it during epoch ${e + 1}, after ${e} decays?`,
      right: String(+v.toPrecision(3)), wrong: near(r, v, [lr * g, lr * g ** (e + 1), lr * g * e], (x) => String(+x.toPrecision(3))), diff: 3,
      why: `${lr} × ${g}^${e} = ${+v.toPrecision(3)}.` };
  },
  top_p(r) {
    const sets = [[0.5, 0.3, 0.1, 0.06, 0.04], [0.4, 0.3, 0.15, 0.1, 0.05], [0.6, 0.2, 0.1, 0.05, 0.05], [0.35, 0.25, 0.2, 0.15, 0.05]];
    const probs = r.pick(sets), p = r.pick([0.5, 0.7, 0.85, 0.9]);
    let c = 0, k = 0;
    for (const x of probs) { c += x; k++; if (c + 1e-9 >= p) break; }
    return { prompt: `Next-token probabilities, sorted, are ${probs.join(", ")}. With top-p (nucleus) sampling at p = ${p}, how many tokens stay in the candidate set?`,
      right: String(k), wrong: near(r, k, [k + 1, k - 1, probs.length, Math.round(p * 10)].filter((x) => x >= 1), String), diff: 3,
      why: `Add tokens from the top until the cumulative probability reaches ${p}: that takes ${k}.` };
  },
  heads(r) {
    const h = r.pick([8, 12, 16, 32]), dh = r.pick([64, 96, 128]);
    return { prompt: `A transformer layer has d_model = ${n(h * dh)} and ${h} attention heads. What is the size of each head (d_model / heads)?`,
      right: String(dh), wrong: near(r, dh, [h * dh / 2, dh * 2, h], String), diff: 3, why: `${n(h * dh)} / ${h} = ${dh}.` };
  },
  agent_context(r) {
    const c0 = r.pick([1500, 2000, 3000]), t = r.pick([300, 500, 800]), k = r.pick([5, 8, 12]);
    const v = c0 + k * t;
    return { prompt: `An agent starts with ${n(c0)} tokens of context. Every tool call appends about ${n(t)} tokens (call plus result), and nothing is trimmed. How large is the context after ${k} tool calls?`,
      right: n(v), wrong: near(r, v, [k * t, c0 + t, c0 * k], n), diff: 2, why: `${n(c0)} + ${k} × ${n(t)} = ${n(v)}.` };
  },
  parallel_tools(r) {
    const k = r.pick([3, 4, 5, 6]), s = r.pick([2, 3, 5]);
    return { prompt: `An agent needs ${k} independent tool calls that each take ${s} seconds. How long do they take run sequentially versus in parallel (ignoring overhead)?`,
      right: `${k * s}s sequential, ${s}s parallel`, wrong: [`${s}s sequential, ${k * s}s parallel`, `${k * s}s sequential, ${k * s}s parallel`, `${k + s}s sequential, ${s}s parallel`], diff: 2,
      why: `Sequential adds the times (${k}×${s}); parallel takes as long as the slowest (${s}s).` };
  },
  latent(r) {
    const f8 = r.pick([8, 8, 4]), px = r.pick([512, 768, 1024]);
    const l = px / f8;
    return { prompt: `A diffusion model's VAE downsamples each side by a factor of ${f8}. What is the width of the latent for a ${px}×${px} image?`,
      right: String(l), wrong: near(r, l, [px * f8, px / (f8 * 2), l * l], String), diff: 3, why: `${px} / ${f8} = ${l}.` };
  },
  batch_pad(r) {
    const lens = [r.int(40, 120), r.int(40, 120), r.int(40, 120), r.int(40, 120)];
    const mx = Math.max(...lens), pad = lens.reduce((s, x) => s + (mx - x), 0);
    return { prompt: `A batch of 4 sequences has lengths ${lens.join(", ")} tokens and is padded to the longest. How many padding tokens are added in total?`,
      right: String(pad), wrong: near(r, pad, [mx * 4, mx - Math.min(...lens), lens.reduce((s, x) => s + x, 0) - mx], String), diff: 3,
      why: `Pad every sequence up to ${mx}: Σ(${mx} − length) = ${pad}.` };
  },
  ensemble_vote(r) {
    const k = r.pick([5, 7, 9]), need = Math.floor(k / 2) + 1;
    return { prompt: `${k} independent model runs vote on an answer and the majority wins. What is the smallest number of runs that must agree to guarantee a majority?`,
      right: String(need), wrong: near(r, need, [k / 2, k, need + 1].filter((x) => Number.isInteger(x) && x !== need), String), diff: 2, why: `A strict majority of ${k} is ${need}.` };
  },
  cache_hit(r) {
    const reqs = r.pick([200, 500, 1000]), hit = r.pick([20, 40, 60, 80]), cost = r.pick([2, 4, 5]);
    const paid = reqs * (1 - hit / 100) * cost;
    return { prompt: `A response cache has a ${hit}% hit rate over ${n(reqs)} requests. A cache miss costs $${cost} of model spend and a hit costs nothing. What is the total spend?`,
      right: `$${n(paid)}`, wrong: near(r, paid, [reqs * (hit / 100) * cost, reqs * cost, reqs * cost * (1 - hit / 100) / 2], (x) => `$${n(Math.round(x))}`), diff: 2,
      why: `misses = ${n(reqs)} × ${100 - hit}% = ${n(reqs * (1 - hit / 100))}; × $${cost} = $${n(paid)}.` };
  },
  // ---- paid social metrics (facebook-marketing-titan) ----
  ad_ctr(r) {
    const imp = r.pick([8000, 12000, 25000, 40000, 100000]), pct = r.pick([0.8, 1, 1.2, 1.5, 2, 2.5]);
    const clicks = Math.round(imp * pct / 100), ctr = clicks / imp * 100;
    return { prompt: `An ad was shown ${n(imp)} times (impressions) and received ${n(clicks)} link clicks. What is the click-through rate (CTR)?`,
      right: `${f(ctr)}%`, wrong: near(r, ctr, [imp / clicks, clicks / imp, clicks / imp * 1000], (x) => `${f(x)}%`), diff: 1,
      why: `CTR = clicks / impressions × 100 = ${n(clicks)} / ${n(imp)} × 100 = ${f(ctr)}%.` };
  },
  ad_cpm(r) {
    const imp = r.pick([20000, 50000, 80000, 125000, 400000]), cost = r.pick([120, 250, 400, 600, 1000]);
    const cpm = cost / imp * 1000;
    return { prompt: `A campaign spent ${n(cost)} and delivered ${n(imp)} impressions. What is its CPM (cost per 1,000 impressions)?`,
      right: `${f(cpm)}`, wrong: near(r, cpm, [cost / imp, cost / imp * 100, imp / cost], (x) => `${f(x)}`), diff: 1,
      why: `CPM = spend / impressions × 1,000 = ${n(cost)} / ${n(imp)} × 1,000 = ${f(cpm)}.` };
  },
  ad_cpc(r) {
    const clicks = r.pick([150, 320, 480, 900, 1500]), cost = r.pick([90, 200, 350, 640, 1200]);
    const cpc = cost / clicks;
    return { prompt: `An ad set spent ${n(cost)} and earned ${n(clicks)} link clicks. What is the cost per click (CPC)?`,
      right: `${f(cpc)}`, wrong: near(r, cpc, [clicks / cost, cpc * 10, cpc * 100], (x) => `${f(x)}`), diff: 1,
      why: `CPC = spend / clicks = ${n(cost)} / ${n(clicks)} = ${f(cpc)}.` };
  },
  ad_cpa(r) {
    const conv = r.pick([12, 25, 40, 64, 90]), cost = r.pick([300, 600, 900, 1500, 2400]);
    const cpa = cost / conv;
    return { prompt: `A lead-generation campaign spent ${n(cost)} and produced ${n(conv)} leads. What is the cost per lead (cost per result)?`,
      right: `${f(cpa)}`, wrong: near(r, cpa, [conv / cost, cost * conv / 100, cpa * 10], (x) => `${f(x)}`), diff: 1,
      why: `Cost per result = spend / results = ${n(cost)} / ${n(conv)} = ${f(cpa)}.` };
  },
  ad_roas(r) {
    const cost = r.pick([500, 800, 1200, 2000, 3500]), mult = r.pick([1.5, 2, 2.5, 3, 4, 5]);
    const rev = Math.round(cost * mult), roas = rev / cost;
    return { prompt: `A sales campaign spent ${n(cost)} and the ads were credited with ${n(rev)} of purchase conversion value. What is the ROAS (return on ad spend)?`,
      right: `${f(roas)}x`, wrong: near(r, roas, [cost / rev, (rev - cost) / cost, rev / cost * 100], (x) => `${f(x)}x`), diff: 2,
      why: `ROAS = conversion value / ad spend = ${n(rev)} / ${n(cost)} = ${f(roas)}x. It is revenue per unit of spend, not profit.` };
  },
  ad_frequency(r) {
    const reach = r.pick([5000, 8000, 12000, 20000, 45000]), freq = r.pick([1.5, 2, 2.5, 3, 4]);
    const imp = Math.round(reach * freq);
    return { prompt: `An ad set delivered ${n(imp)} impressions to ${n(reach)} unique accounts (reach). What is its average frequency?`,
      right: f(imp / reach), wrong: near(r, imp / reach, [reach / imp, imp - reach, imp / reach * 10], (x) => f(x)), diff: 1,
      why: `Frequency = impressions / reach = ${n(imp)} / ${n(reach)} = ${f(imp / reach)} views per person on average.` };
  },
  ad_conv_rate(r) {
    const clicks = r.pick([400, 800, 1250, 2000, 5000]), pct = r.pick([1, 2, 2.5, 3, 4, 5]);
    const conv = Math.round(clicks * pct / 100);
    return { prompt: `${n(clicks)} people clicked an ad and landed on a page, and ${n(conv)} of them bought. What is the landing-page conversion rate?`,
      right: `${f(conv / clicks * 100)}%`, wrong: near(r, conv / clicks * 100, [clicks / conv, conv / clicks, conv / (clicks * 1000) * 100], (x) => `${f(x)}%`), diff: 2,
      why: `Conversion rate = conversions / clicks × 100 = ${n(conv)} / ${n(clicks)} × 100 = ${f(conv / clicks * 100)}%.` };
  },
  ad_break_even(r) {
    const margin = r.pick([20, 25, 30, 40, 50]);
    const be = 100 / margin;
    return { prompt: `A shop earns a ${margin}% gross margin on each sale before ad costs. What is its break-even ROAS?`,
      right: `${f(be)}x`, wrong: near(r, be, [margin / 100, margin, be * 2], (x) => `${f(x)}x`), diff: 3,
      why: `Break-even ROAS = 1 / margin = 100 / ${margin} = ${f(be)}x. Below it, every sale loses money once ad spend is counted.` };
  },
  ad_daily(r) {
    const days = r.pick([5, 7, 10, 14, 21, 30]), daily = r.pick([10, 15, 20, 25, 40, 50]);
    const life = days * daily;
    return { prompt: `A campaign is planned to spend about ${n(daily)} a day for ${days} days. What lifetime budget matches that plan?`,
      right: `${n(life)}`, wrong: near(r, life, [daily + days, life * 7, daily * 7], (x) => `${n(Math.round(x))}`), diff: 1,
      why: `${n(daily)} × ${days} = ${n(life)}.` };
  },
  ad_reach_from_budget(r) {
    const budget = r.pick([200, 500, 800, 1500]), cpm = r.pick([5, 8, 10, 12, 20]);
    const imp = budget / cpm * 1000;
    return { prompt: `A campaign has a ${n(budget)} budget and an average CPM of ${cpm}. About how many impressions can it buy?`,
      right: n(Math.round(imp)), wrong: near(r, imp, [budget / cpm, budget * cpm, budget / cpm * 100], (x) => n(Math.round(x))), diff: 2,
      why: `impressions = budget / CPM × 1,000 = ${n(budget)} / ${cpm} × 1,000 = ${n(Math.round(imp))}.` };
  },
};

/** which generators suit which subject; matched by slug prefix in the engine. Specs may also list their own. */
export const CALC_SETS: Record<string, string[]> = {
  llm: ["tokens_words", "ctx_budget", "api_cost", "api_cost_batch", "rate_limit", "backoff", "throughput", "top_p", "heads", "model_memory", "cache_hit"],
  api: ["tokens_words", "ctx_budget", "api_cost", "api_cost_batch", "rate_limit", "backoff", "throughput", "cache_hit"],
  rag: ["chunk_count", "chunk_stride", "precision_recall", "mrr", "cosine", "emb_storage", "ctx_budget", "tokens_words"],
  vec: ["cosine", "l2", "emb_storage", "precision_recall", "mrr", "chunk_count"],
  ml: ["accuracy", "precision_recall", "f1", "train_steps", "grad_accum", "lr_decay", "batch_pad", "ensemble_vote"],
  tune: ["lora_params", "model_memory", "train_steps", "grad_accum", "lr_decay", "batch_pad"],
  agent: ["agent_context", "parallel_tools", "ctx_budget", "api_cost", "backoff", "rate_limit"],
  image: ["latent", "throughput", "train_steps"],
  eval: ["accuracy", "precision_recall", "f1", "mrr", "ensemble_vote", "api_cost"],
};
