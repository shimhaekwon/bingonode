// services/bingoService.js
// ⚠️ DB 접근 없음: getRecentHistory 관련 제거

const DEFAULT_OPTIONS = {
  numberRangeMax: 45,
  setCount: 5,
  numbersPerSet: 6,
  includeBonus: false,

  // 사용자 기본 선호
  nonExposedRounds: 8,
  minNonExposedCount: 0,
  candidatePoolSize: 12,           // 다양성 위해 기본 12
  kSetting: 7,                     // k=7 → P≥3 목표
  historyRounds: 30,               // 윈도우 크기(N)
  chiSquareWeighting: true,
  centralIntervalWeighting: true,

  // 샘플링/정렬/윈도우 관련
  temperature: 1.0,                // softmax 온도
  seed: undefined,
  historyIsNewestFirst: true,      // history[0]이 최신인지 여부
  roundField: 'round',             // 회차 필드명 (예: 'round', 'drwNo' 등)
  targetRound: undefined,          // 기준 회차 값 (number/string)
  excludeCurrentFromWindow: true,  // 윈도우에서 기준 회차를 제외하여 "이전 N회"만 사용
  useWindowedHistory: true         // true면 윈도우 슬라이싱 적용
};

// --------- 유틸/통계 함수들 ---------
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

// Softmax 가중치 변환
function toSoftmaxWeights(vals, temperature = 1.0) {
  if (!Array.isArray(vals) || vals.length === 0) return [];
  const t = Math.max(0.1, temperature); // t 낮을수록 분포가 날카로워짐
  const maxV = Math.max(...vals);
  const exps = vals.map(v => Math.exp((v - maxV) / t));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map(e => e / sum);
}

// ---------- 히스토리 분석 ----------
function analyzeHistory(history, numberRangeMax) {
  const freq = Array(numberRangeMax + 1).fill(0);
  const lastSeenIndex = Array(numberRangeMax + 1).fill(null);

  // (가정) history[0]이 "해당 윈도우에서 가장 최근"
  history.forEach((row, idx) => {
    const nums = [row.no1, row.no2, row.no3, row.no4, row.no5, row.no6].filter(Boolean);
    nums.forEach(n => {
      freq[n]++;
      lastSeenIndex[n] = idx; // 가장 최근 출현 인덱스가 되도록 덮어쓰기
    });
    if (row.no7) {
      lastSeenIndex[row.no7] = idx;
    }
  });

  // skip = 마지막 등장으로부터 경과 회차 (윈도우 내 기준)
  const skip = lastSeenIndex.map(v =>
    v === null ? history.length : (history.length - 1 - v)
  );

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

// ---------- 히스토리 윈도우 산정 ----------
function computeEffectiveHistory(history, options) {
  const {
    historyIsNewestFirst = true,
    roundField = 'round',
    targetRound,
    historyRounds = 30,
    excludeCurrentFromWindow = true,
    useWindowedHistory = true
  } = options;

  if (!useWindowedHistory || !Array.isArray(history) || history.length === 0) {
    // 슬라이싱 비적용: 그대로 반환 (정렬은 downstream에서 가정)
    return { effectiveHistory: history, windowInfo: { usedFullHistory: true } };
  }

  // 정렬 방향에 따른 탐색/슬라이스
  const N = Math.max(1, Math.min(historyRounds, history.length));
  let startIdx = 0;
  let endIdx = 0;
  let pos = -1;

  // targetRound가 있으면 해당 회차의 위치를 찾음
  if (targetRound !== undefined && targetRound !== null) {
    pos = history.findIndex(row => row && row[roundField] === targetRound);
    // 못 찾으면 경고 정보와 함께 디폴트 윈도우 사용
  }

  if (historyIsNewestFirst) {
    // 최신이 앞(0)인 배열
    if (pos >= 0) {
      // 기준 회차를 포함하는 인덱스 pos 기준
      // "이전 N회"를 원한다면 기준 회차는 제외하고 pos+1에서 pos+1+N 슬라이스
      if (excludeCurrentFromWindow) {
        startIdx = pos + 1;
        endIdx = Math.min(pos + 1 + N, history.length);
      } else {
        startIdx = pos;
        endIdx = Math.min(pos + N, history.length);
      }
    } else {
      // targetRound를 못 찾았으면 최상단부터 N개(최신 N회)
      startIdx = 0;
      endIdx = N;
    }

    const slice = history.slice(startIdx, endIdx);
    // 최신이 앞인 정렬을 downstream이 가정하므로 그대로 반환
    return {
      effectiveHistory: slice,
      windowInfo: {
        usedFullHistory: false,
        order: 'newestFirst',
        targetRoundFound: pos >= 0,
        targetRoundIndex: pos,
        startIdx,
        endIdx,
        size: slice.length,
        excludeCurrentFromWindow
      }
    };
  } else {
    // 오래된 것이 앞, 최신이 뒤인 배열
    if (pos >= 0) {
      if (excludeCurrentFromWindow) {
        // pos 이전 N개: [pos - N, pos)
        startIdx = Math.max(0, pos - N);
        endIdx = pos;
      } else {
        // pos 포함 N개: [pos - (N-1), pos+1)
        startIdx = Math.max(0, pos - (N - 1));
        endIdx = Math.min(pos + 1, history.length);
      }
    } else {
      // targetRound를 못 찾았으면 끝에서 N개(최신 N회)
      startIdx = Math.max(0, history.length - N);
      endIdx = history.length;
    }

    const slice = history.slice(startIdx, endIdx);
    // downstream 일관성을 위해 "최신이 앞"이 되도록 뒤집어서 반환
    const normalized = slice.slice().reverse();
    return {
      effectiveHistory: normalized,
      windowInfo: {
        usedFullHistory: false,
        order: 'oldestFirst->normalizedToNewestFirst',
        targetRoundFound: pos >= 0,
        targetRoundIndex: pos,
        originalStartIdx: startIdx,
        originalEndIdx: endIdx,
        size: normalized.length,
        excludeCurrentFromWindow
      }
    };
  }
}

// ---------- 후보 풀 계산 ----------
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

  if (options.nonExposedRounds > 0) {
    for (let n = 1; n <= maxN; n++) {
      if (skip[n] >= options.nonExposedRounds) w[n] *= 1.1;  // 완화된 보너스
      else w[n] *= 0.95;                                    // 완화된 감쇠
    }
  }

  w = normalizeWeights(w);

  const candidatePoolSize = Math.max(6, Math.min(options.candidatePoolSize ?? 12, 45));
  const pool = Array.from({ length: maxN }, (_, i) => i + 1)
    .sort((a, b) => w[b] - w[a])
    .slice(0, candidatePoolSize);

  return { pool, finalWeights: w };
}

// ---------- 1세트 생성 ----------
function generateOneSet(pool, weights, options, effectiveHistory, rand) {
  const need = options.numbersPerSet;
  const selected = [];

  // 최근 N회 번호 제거(가정: effectiveHistory[0]이 최신)
  let nonExposed = pool;
  if (options.nonExposedRounds > 0) {
    const recentNums = new Set();
    const recentSlice = effectiveHistory.slice(0, options.nonExposedRounds);

    recentSlice.forEach(row => {
      [row.no1,row.no2,row.no3,row.no4,row.no5,row.no6,row.no7 ?? undefined]
        .filter(x => typeof x === 'number')
        .forEach(n => recentNums.add(n));
    });

    nonExposed = pool.filter(n => !recentNums.has(n));
  }

  const minNonExposed = Math.max(0, options.minNonExposedCount);

  // 1) 최소 비노출 번호 충족
  while (selected.length < Math.min(minNonExposed, need) && nonExposed.length > 0) {
    const raw = nonExposed.map(n => weights[n]);
    const w = toSoftmaxWeights(raw, options.temperature);
    const pick = choiceWeighted(nonExposed, w, rand);
    selected.push(pick);
    nonExposed = nonExposed.filter(n => n !== pick);
  }

  // 2) 나머지 선택
  let remain = pool.filter(n => !selected.includes(n));
  while (selected.length < need && remain.length > 0) {
    const raw = remain.map(n => weights[n]);
    const w = toSoftmaxWeights(raw, options.temperature);
    const pick = choiceWeighted(remain, w, rand);
    selected.push(pick);
    remain = remain.filter(n => n !== pick);
  }

  selected.sort((a, b) => a - b);

  let bonus = null;
  if (options.includeBonus) {
    const leftover = pool.filter(n => !selected.includes(n));
    if (leftover.length > 0) {
      const raw = leftover.map(n => weights[n]);
      const w = toSoftmaxWeights(raw, options.temperature);
      bonus = choiceWeighted(leftover, w, rand);
    }
  }

  return { numbers: selected, bonus, weights: undefined };
}

// ---------- 세트 다양성 확보 ----------
function diversify(sets, penaltyThreshold = 3) {
  const unique = [];
  for (const s of sets) {
    const tooSimilar = unique.some(u => {
      const inter = s.numbers.filter(x => u.numbers.includes(x)).length;
      return inter >= penaltyThreshold;
    });
    if (!tooSimilar) unique.push(s);
    else unique.push(s); // 현 구조 유지(페널티 정책 확장 여지)
  }
  return unique;
}

// ---------- 메인 API ----------
export function generatePredictions(userOptions = {}) {
  const options = { ...DEFAULT_OPTIONS, ...userOptions };
  const rawHistory = Array.isArray(userOptions.history) ? userOptions.history : [];

  // 1) 회차 기준 "이전 N회" 윈도우 산정
  const { effectiveHistory, windowInfo } = computeEffectiveHistory(rawHistory, options);

  // 2) 후보 풀/가중치 계산은 항상 '윈도우된' 히스토리를 사용
  const { pool, finalWeights } = buildCandidatePool(effectiveHistory, options);

  // 3) 난수 시드
  const rand = options.seed != null
    ? mulberry32(options.seed)
    : mulberry32((Date.now() ^ (Math.random() * 0xFFFFFFFF)) >>> 0);

  // 4) 세트 생성 (최근 N회 배제 로직도 '윈도우된' 히스토리에 맞춤)
  const sets = [];
  for (let i = 0; i < options.setCount; i++) {
    sets.push(generateOneSet(pool, finalWeights, options, effectiveHistory, rand));
  }

  const diversified = diversify(sets, options.kSetting === 10 ? 4 : 3);

  return {
    options,
    windowInfo,           // ➜ 디버깅/검증용: 실제로 어떤 구간이 사용되었는지 확인 가능
    sets: diversified,
    candidatePool: pool
  };
}