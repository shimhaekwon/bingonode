const { getRecentHistory } = '@models/bingo.model.js';

const DEFAULT_OPTIONS = {
  numberRangeMax: 45,
  setCount: 5,
  numbersPerSet: 6,
  includeBonus: false,
  nonExposedRounds: 8,
  minNonExposedCount: 0,
  candidatePoolSize: 10,
  kSetting: 7,
  historyRounds: 30,
  chiSquareWeighting: true,
  centralIntervalWeighting: true,
  seed: undefined
};

function mulberry32(a) {
  return function() {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function choiceWeighted(arr, weights, rand) {
  const total = weights.reduce((s, w) => s + w, 0);
  const r = rand() * total;
  let cum = 0;
  for (let i = 0; i < arr.length; i++) {
    cum += weights[i];
    if (r <= cum) return arr[i];
  }
  return arr[arr.length - 1];
}

function analyzeHistory(history, numberRangeMax) {
  const freq = Array(numberRangeMax + 1).fill(0);
  const lastSeenIndex = Array(numberRangeMax + 1).fill(null);
  history.forEach((row, idx) => {
    const nums = [row.no1, row.no2, row.no3, row.no4, row.no5, row.no6].filter(Boolean);
    nums.forEach(n => {
      freq[n]++;
      if (lastSeenIndex[n] === null) lastSeenIndex[n] = idx;
    });
    if (row.no7) {
      if (lastSeenIndex[row.no7] === null) lastSeenIndex[row.no7] = idx;
    }
  });
  const skip = lastSeenIndex.map(v => (v === null ? history.length : (history.length - 1 - v)));
  return { freq, skip };
}

function chiSquareWeights(freq, draws, numberRangeMax) {
  const E = (draws * 6) / numberRangeMax;
  const eps = 1e-6;
  const weights = [];
  for (let n = 1; n <= numberRangeMax; n++) {
    const O = freq[n] || 0;
    const chi = (O - E) * (O - E) / (E + eps);
    weights[n] = 1 / (1 + chi);
  }
  return weights;
}

function centralIntervalWeights(numberRangeMax) {
  const m = (numberRangeMax + 1) / 2;
  const sigma = numberRangeMax / 6;
  const weights = [];
  for (let n = 1; n <= numberRangeMax; n++) {
    const d = (n - m) / sigma;
    weights[n] = Math.exp(-0.5 * d * d);
  }
  return weights;
}

function normalizeWeights(w) {
  const max = Math.max(...w.slice(1));
  const eps = 1e-12;
  return w.map((v, i) => (i === 0 ? 0 : (v + eps) / (max + eps)));
}

export function buildCandidatePool(history, options) {
  const maxN = options.numberRangeMax;
  const { freq, skip } = analyzeHistory(history, maxN);
  const draws = history.length;
  let w = Array(maxN + 1).fill(1);

  if (options.chiSquareWeighting) {
    const wChi = chiSquareWeights(freq, draws, maxN);
    for (let n = 1; n <= maxN; n++) w[n] *= wChi[n];
  }
  if (options.centralIntervalWeighting) {
    const wCentral = centralIntervalWeights(maxN);
    for (let n = 1; n <= maxN; n++) w[n] *= wCentral[n];
  }
  if (options.nonExposedRounds && options.nonExposedRounds > 0) {
    for (let n = 1; n <= maxN; n++) {
      if (skip[n] >= options.nonExposedRounds) w[n] *= 1.2;
      else w[n] *= 0.9;
    }
  }
  w = normalizeWeights(w);

  const candidatePoolSize = Math.max(6, Math.min(options.candidatePoolSize ?? 10, 45));
  const candidates = Array.from({ length: maxN }, (_, i) => i + 1)
    .sort((a, b) => w[b] - w[a])
    .slice(0, candidatePoolSize);

  return { pool: candidates, finalWeights: w };
}

function generateOneSet(pool, weights, options, history, rand) {
  const need = options.numbersPerSet;
  const selected = [];

  let nonExposed = pool;
  if (options.nonExposedRounds && options.nonExposedRounds > 0) {
    const recentNums = new Set();
    history.slice(0, options.nonExposedRounds).forEach(row => {
      [row.no1,row.no2,row.no3,row.no4,row.no5,row.no6,row.no7 ?? undefined]
        .filter(x => typeof x === 'number')
        .forEach(n => recentNums.add(n));
    });
    nonExposed = pool.filter(n => !recentNums.has(n));
  }

  const minNonExposed = Math.max(0, options.minNonExposedCount ?? 0);
  while (selected.length < Math.min(minNonExposed, need) && nonExposed.length > 0) {
    const w = nonExposed.map(n => weights[n]);
    const pick = choiceWeighted(nonExposed, w, rand);
    selected.push(pick);
    nonExposed = nonExposed.filter(n => n !== pick);
  }

  let remain = pool.filter(n => !selected.includes(n));
  while (selected.length < need && remain.length > 0) {
    const w = remain.map(n => weights[n]);
    const pick = choiceWeighted(remain, w, rand);
    selected.push(pick);
    remain = remain.filter(n => n !== pick);
  }

  selected.sort((a, b) => a - b);

  let bonus = null;
  if (options.includeBonus) {
    const leftover = pool.filter(n => !selected.includes(n));
    if (leftover.length > 0) {
      const w = leftover.map(n => weights[n]);
      bonus = choiceWeighted(leftover, w, rand);
    }
  }

  return { numbers: selected, bonus, weights: undefined };
}

function diversify(sets, penaltyThreshold = 3) {
  const unique = [];
  for (const s of sets) {
    const tooSimilar = unique.some(u => {
      const inter = s.numbers.filter(x => u.numbers.includes(x)).length;
      return inter >= penaltyThreshold;
    });
    if (!tooSimilar) unique.push(s);
    else unique.push(s);
  }
  return unique;
}

export function generatePredictions(userOptions = {}) {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };
  const history = (options.historyRounds && options.historyRounds > 0)
    ? getRecentHistory(options.historyRounds)
    : [];
  const { pool, finalWeights } = buildCandidatePool(history, options);
  const rand = options.seed ? mulberry32(options.seed) : Math.random;

  const sets = [];
  for (let i = 0; i < options.setCount; i++) {
    sets.push(generateOneSet(pool, finalWeights, options, history, rand));
  }
  const diversified = diversify(sets, options.kSetting === 10 ? 4 : 3);
  return { options, sets: diversified, candidatePool: pool };
}