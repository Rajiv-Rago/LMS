/**
 * Inter-rater agreement helpers for calibration.
 * - Cohen's kappa for binary checks
 * - Spearman rank correlation for Likert scores
 * - Confusion rows for binary disagreements
 */

export interface AgreementPair {
  exampleId: string;
  judge: number; // 0/1 for binary, 1..5 for Likert
  human: number;
}

export interface KappaResult {
  n: number;
  agreement: number;
  expected: number;
  kappa: number;
}

export function cohensKappa(pairs: AgreementPair[]): KappaResult {
  const n = pairs.length;
  if (n === 0) return { n, agreement: 0, expected: 0, kappa: 0 };

  let agree = 0;
  let judgePos = 0;
  let humanPos = 0;
  for (const p of pairs) {
    if (p.judge === p.human) agree += 1;
    if (p.judge === 1) judgePos += 1;
    if (p.human === 1) humanPos += 1;
  }
  const po = agree / n;
  const pPos = (judgePos / n) * (humanPos / n);
  const pNeg = ((n - judgePos) / n) * ((n - humanPos) / n);
  const pe = pPos + pNeg;
  const kappa = pe === 1 ? 1 : (po - pe) / (1 - pe);
  return { n, agreement: po, expected: pe, kappa };
}

export interface SpearmanResult {
  n: number;
  rho: number;
}

export function spearmanCorrelation(pairs: AgreementPair[]): SpearmanResult {
  const n = pairs.length;
  if (n < 2) return { n, rho: 0 };

  const judgeRanks = rank(pairs.map((p) => p.judge));
  const humanRanks = rank(pairs.map((p) => p.human));

  const meanJ = mean(judgeRanks);
  const meanH = mean(humanRanks);
  let num = 0;
  let denJ = 0;
  let denH = 0;
  for (let i = 0; i < n; i += 1) {
    const dj = judgeRanks[i] - meanJ;
    const dh = humanRanks[i] - meanH;
    num += dj * dh;
    denJ += dj * dj;
    denH += dh * dh;
  }
  const den = Math.sqrt(denJ * denH);
  return { n, rho: den === 0 ? 0 : num / den };
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function rank(values: number[]): number[] {
  const sorted = [...values]
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);

  const ranks = new Array(values.length).fill(0);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].value === sorted[i].value) j += 1;
    const avgRank = (i + j) / 2 + 1; // 1-indexed
    for (let k = i; k <= j; k += 1) {
      ranks[sorted[k].index] = avgRank;
    }
    i = j + 1;
  }
  return ranks;
}

export interface ConfusionRow {
  exampleId: string;
  judge: number;
  human: number;
}

export function disagreements(pairs: AgreementPair[]): ConfusionRow[] {
  return pairs
    .filter((p) => p.judge !== p.human)
    .map((p) => ({ exampleId: p.exampleId, judge: p.judge, human: p.human }));
}

export const CALIBRATION_THRESHOLD = 0.6;
