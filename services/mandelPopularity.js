// services/mandelPopularity.js
// 사람들이 많이 찍는 번호일수록 인기도 점수가 높음.
// 1등 당첨 시 동점자 수와 양의 상관관계 → 비인기 번호로 당첨될수록 1인당 수령액 ↑
//
// 가중치 출처:
//   - 1~31: 생일·기념일 편향 (압도적 선호)
//   - 7배수: 7,14,21,28,35,42 — 행운수 선호 (한·서양 공통)
//   - 3,9,13: 추가 행운수
//
// 검증: bingo 프로젝트 compare_strategies.py — 1222회 한국 로또 1등 데이터로
//       인기도 4분위 분석 결과 Q4(인기) 분위가 Q1(비인기) 대비 동점자 +23.9%.
'use strict';

const LOTTO_MIN = 1;
const LOTTO_MAX = 45;

const POPULAR_MULTIPLES_OF_7 = new Set([7, 14, 21, 28, 35, 42]);
const POPULAR_LUCKY = new Set([3, 9, 13]);

function popularity(n) {
  let score = 1.0;
  if (n <= 31) score *= 1.5;
  if (POPULAR_MULTIPLES_OF_7.has(n)) score *= 1.3;
  if (POPULAR_LUCKY.has(n)) score *= 1.15;
  return score;
}

function popularityVector() {
  const v = new Array(LOTTO_MAX + 1).fill(0);
  for (let n = LOTTO_MIN; n <= LOTTO_MAX; n++) v[n] = popularity(n);
  return v;
}

// 평균 0, 표준편차 1로 정규화한 인기도 벡터 (인덱스 0 = 0)
function popularityZ() {
  const raw = [];
  for (let n = LOTTO_MIN; n <= LOTTO_MAX; n++) raw.push(popularity(n));
  const mean = raw.reduce((a, b) => a + b, 0) / raw.length;
  const variance = raw.reduce((s, v) => s + (v - mean) ** 2, 0) / raw.length;
  const std = Math.sqrt(variance) || 1e-9;
  const z = new Array(LOTTO_MAX + 1).fill(0);
  for (let n = LOTTO_MIN; n <= LOTTO_MAX; n++) {
    z[n] = (popularity(n) - mean) / std;
  }
  return z;
}

// 6개 번호 조합의 평균 인기도
function combinationPopularity(nums) {
  if (!Array.isArray(nums) || nums.length === 0) return 0;
  let sum = 0;
  for (const n of nums) sum += popularity(n);
  return sum / nums.length;
}

module.exports = {
  popularity,
  popularityVector,
  popularityZ,
  combinationPopularity,
  LOTTO_MIN,
  LOTTO_MAX,
};
