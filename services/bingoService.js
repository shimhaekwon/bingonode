// services/bingoService.js
'use strict';

const axios = require('axios');
const bingoModel = require('@models/bingoModel.js');

// ---- p-limit (CJS/ESM 호환 + 폴백) ----
let pLimit = null;
try {
  pLimit = require('p-limit');
  if (pLimit && typeof pLimit !== 'function' && pLimit.default) {
    pLimit = pLimit.default;
  }
} catch {
  // 미설치 시 동시 1개로 degrade
  pLimit = (concurrency) => {
    let activeCount = 0;
    const queue = [];
    const next = () => {
      activeCount--;
      if (queue.length > 0) queue.shift()();
    };
    return (fn, ...args) => new Promise((resolve, reject) => {
      const run = () => {
        activeCount++;
        Promise.resolve().then(() => fn(...args)).then(resolve, reject).finally(next);
      };
      activeCount < Math.max(1, concurrency) ? run() : queue.push(run);
    });
  };
}

// ===================== LOG/UTILS =====================
const DEBUG = process.env.DEBUG_SYNC === '1';

const LOG = {
  info: (...args) => console.log('[bingo:info]', ...args),
  warn: (...args) => console.warn('[bingo:warn]', ...args),
  err:  (...args) => console.error('[bingo:err ]', ...args),
  dbg:  (...args) => { if (DEBUG) console.log('[bingo:dbg ]', ...args); }
};

function brief(obj, maxLen = 200) {
  try {
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
    return s.length <= maxLen ? s : s.slice(0, maxLen) + '...(' + s.length + ' bytes)';
  } catch {
    return String(obj);
  }
}

function mem() {
  const { rss, heapUsed, heapTotal } = process.memoryUsage();
  return `rss=${(rss/1e6).toFixed(1)}MB heapUsed=${(heapUsed/1e6).toFixed(1)}MB heapTotal=${(heapTotal/1e6).toFixed(1)}MB`;
}

const JSON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Referer': 'https://www.dhlottery.co.kr/gameResult.do?method=byWin',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'X-Requested-With': 'XMLHttpRequest',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
};

const HTML_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Referer': 'https://www.dhlottery.co.kr/',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  'Upgrade-Insecure-Requests': '1',
  'Connection': 'keep-alive'
};

// ===================== HELPERS =====================
function normalizeMaxSeq(dbLatest) {
  if (dbLatest == null) return { maxSeq: 0 };
  if (typeof dbLatest === 'number') return { maxSeq: dbLatest };
  const candidates = ['maxSeq', 'maxseq', 'max_eq', 'maxeq', 'maxed', 'max', 'seq', 'lastSeq', 'latest', 'latestSeq'];
  for (const k of candidates) {
    if (Number.isInteger(dbLatest?.[k])) return { maxSeq: dbLatest[k] };
  }
  const numeric = Object.values(dbLatest).find(v => Number.isInteger(v));
  return { maxSeq: numeric ?? 0 };
}

async function retry(fn, { retries = 2, baseDelay = 400 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < retries) {
        const wait = baseDelay * Math.pow(2, i);
        LOG.warn(`retry: attempt ${i + 1}/${retries + 1} failed: ${e?.message} -> wait ${wait}ms`);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }
  throw lastErr;
}

// ===================== DHL fetchers =====================
async function fetchLatestRound_v1(maxeq) {
  // JSON endpoint
  const qs = Number.isInteger(maxeq) && maxeq > 0 ? `?srchDir=center&srchLtEpsd=${maxeq}` : '?srchDir=center';
  const url = 'https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do' + qs;
  LOG.dbg('fetchLatestRound_v1: GET', url);
  const started = Date.now();

  const res = await axios.get(url, {
    headers: JSON_HEADERS,
    timeout: 10_000,
    validateStatus: (s) => s >= 200 && s < 500,
    maxRedirects: 3
  });

  LOG.dbg('fetchLatestRound_v1: status', res.status, 'elapsed', `${Date.now() - started}ms`);
  const data = res?.data;

  const latest =
    data?.data?.list?.[0]?.ltEpsd ??
    data?.list?.[0]?.ltEpsd ??
    data?.drwNo ??
    data?.latest ??
    null;

  LOG.dbg('fetchLatestRound_v1: parsed latest =', latest);
  if (!Number.isInteger(latest)) throw new Error('fetchLatestRound_v1: latest not found');
  return latest;
}

async function fetchLatestRound_v2() {
  // HTML 파싱
  const url = 'https://www.dhlottery.co.kr/common.do?method=main';
  LOG.dbg('fetchLatestRound_v2: GET', url);
  const started = Date.now();

  const html = await axios.get(url, {
    headers: HTML_HEADERS,
    timeout: 10_000,
    validateStatus: s => s >= 200 && s < 500,
    maxRedirects: 3
  }).then(r => r.data);

  LOG.dbg('fetchLatestRound_v2: html length', html?.length, 'elapsed', `${Date.now() - started}ms`);
  if (!html || typeof html !== 'string' || html.length < 500) {
    throw new Error(`fetchLatestRound_v2: unexpected html (len=${html?.length ?? 0})`);
  }

  let m = html.match(/id="lottoDrwNo"[^>]*>\s*(\d+)\s*</);
  if (!m) m = html.match(/name="lottoDrwNo"[^>]*value="(\d+)"/);
  const latest = m ? parseInt(m[1], 10) : null;

  LOG.dbg('fetchLatestRound_v2: parsed latest =', latest);
  if (!Number.isInteger(latest)) throw new Error('fetchLatestRound_v2: latest draw number not found');
  return latest;
}

async function fetchRoundsRange(startSeq, endSeq) {
  const url = `https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do?srchStrLtEpsd=${startSeq}&srchEndLtEpsd=${endSeq}&_=${Date.now()}`;
  LOG.dbg('fetchRoundsRange: GET', url);
  const t0 = Date.now();

  const { data, status } = await axios.get(url, {
    headers: JSON_HEADERS,
    timeout: 15_000,
    validateStatus: s => s >= 200 && s < 500,
    maxRedirects: 3
  });

  LOG.dbg('fetchRoundsRange: status', status, 'elapsed', `${Date.now() - t0}ms`);

  // 응답 데이터 파싱
  // 형식: { data: { list: [{ ltEpsd: 1211, tm1WnNo: 23, tm2WnNo: 26, ..., bnsWnNo: 10 }, ...] } }
  const list = data?.data?.list || data?.list || [];
  
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(`fetchRoundsRange: no data returned for ${startSeq}..${endSeq}`);
  }

  const results = list.map(item => ({
    seq: parseInt(item.ltEpsd, 10),
    no1: parseInt(item.tm1WnNo, 10),
    no2: parseInt(item.tm2WnNo, 10),
    no3: parseInt(item.tm3WnNo, 10),
    no4: parseInt(item.tm4WnNo, 10),
    no5: parseInt(item.tm5WnNo, 10),
    no6: parseInt(item.tm6WnNo, 10),
    no7: parseInt(item.bnsWnNo, 10),
    bonus: parseInt(item.bnsWnNo, 10),
    drawDate: item.ltRflYmd || null
  })).filter(item => Number.isInteger(item.seq) && item.seq >= 1);

  LOG.dbg('fetchRoundsRange: parsed', results.length, 'rounds');
  return results;
}

async function fetchRoundDetail(drwNo) {
  const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drwNo}`;
  LOG.dbg('fetchRoundDetail: GET', url);
  const t0 = Date.now();

  const { data, status } = await axios.get(url, {
    headers: JSON_HEADERS,
    timeout: 10_000,
    validateStatus: s => s >= 200 && s < 500,
    maxRedirects: 3
  });

  LOG.dbg('fetchRoundDetail: status', status, 'elapsed', `${Date.now() - t0}ms`);
  LOG.dbg('fetchRoundDetail: returnValue', data?.returnValue, 'drwNo', data?.drwNo);

  if (data?.returnValue !== 'success') {
    throw new Error(`getLottoNumber failed for ${drwNo} (returnValue=${data?.returnValue ?? 'n/a'})`);
  }

  const detail = {
    seq: data.drwNo,
    no1: data.drwtNo1, no2: data.drwtNo2, no3: data.drwtNo3,
    no4: data.drwtNo4, no5: data.drwtNo5, no6: data.drwtNo6,
    no7: data.bnusNo,
    bonus: data.bnusNo,
    drawDate: data.drwNoDate,
  };
  LOG.dbg('fetchRoundDetail: parsed detail', brief(detail, 300));
  return detail;
}

async function fetchRoundDetailFromHtml(drwNo) {
  const url = `https://www.dhlottery.co.kr/gameResult.do?method=byWin&drwNo=${drwNo}`;
  LOG.dbg('fetchRoundDetailFromHtml: GET', url);
  const t0 = Date.now();

  const html = await axios.get(url, {
    headers: HTML_HEADERS,
    timeout: 10_000,
    validateStatus: s => s >= 200 && s < 500,
    maxRedirects: 3
  }).then(r => r.data);

  LOG.dbg('fetchRoundDetailFromHtml: elapsed', `${Date.now() - t0}ms`);

  if (!html || typeof html !== 'string' || html.length < 500) {
    throw new Error(`fetchRoundDetailFromHtml: unexpected html (len=${html?.length ?? 0})`);
  }

  // Parse winning numbers from HTML
  // Pattern 1: <span class="num">XX</span>
  const numMatches = html.match(/<span class="num">(\d+)<\/span>/g);
  if (numMatches && numMatches.length >= 6) {
    const numbers = numMatches.slice(0, 7).map(m => {
      const match = m.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    }).filter(n => n !== null && n >= 1 && n <= 45);

    if (numbers.length >= 6) {
      const detail = {
        seq: drwNo,
        no1: numbers[0],
        no2: numbers[1],
        no3: numbers[2],
        no4: numbers[3],
        no5: numbers[4],
        no6: numbers[5],
        no7: numbers[6] || null,
        bonus: numbers[6] || null,
        drawDate: null
      };
      LOG.dbg('fetchRoundDetailFromHtml: parsed detail', brief(detail, 300));
      return detail;
    }
  }

  // Pattern 2:另一种形式
  const altPattern = html.match(/drwtNo(\d+)["']?\s*:\s*(\d+)/g);
  if (altPattern) {
    const numbers = [];
    for (const m of altPattern) {
      const match = m.match(/drwtNo\d+["']?\s*:\s*(\d+)/);
      if (match) numbers.push(parseInt(match[1], 10));
    }
    if (numbers.length >= 6) {
      const detail = {
        seq: drwNo,
        no1: numbers[0], no2: numbers[1], no3: numbers[2],
        no4: numbers[3], no5: numbers[4], no6: numbers[5],
        no7: numbers[6] || null,
        bonus: numbers[6] || null,
        drawDate: null
      };
      LOG.dbg('fetchRoundDetailFromHtml: parsed detail (alt)', brief(detail, 300));
      return detail;
    }
  }

  throw new Error(`fetchRoundDetailFromHtml: could not parse numbers from HTML for drwNo=${drwNo}`);
}

async function probeLatestByWalkingFrom(dbMaxSeq, maxProbe = 30) {
  LOG.dbg('probeLatestByWalkingFrom: start from', dbMaxSeq, 'maxProbe', maxProbe);
  let latest = dbMaxSeq;
  for (let r = dbMaxSeq + 1; r <= dbMaxSeq + maxProbe; r++) {
    try {
      const d = await fetchRoundDetailFromHtml(r);
      if (d?.seq === r) latest = r;
      else break;
    } catch {
      break;
    }
  }
  if (latest === dbMaxSeq) {
    for (let r = dbMaxSeq; r >= Math.max(1, dbMaxSeq - 5); r--) {
      try {
        const d = await fetchRoundDetailFromHtml(r);
        if (d?.seq === r) return r;
      } catch { /* ignore */ }
    }
  }
  return latest;
}

// ===================== SYNC ENTRY POINT =====================
let syncing = false;

async function syncLatest() {
  LOG.info('syncLatest: invoked', new Date().toISOString(), mem());
  if (syncing) {
    LOG.warn('syncLatest: already running -> skip');
    return { running: true, message: 'sync already running' };
  }
  syncing = true;
  console.time('syncLatest');

  try {
    // 1) DB 최신 회차
    console.time('syncLatest:getDbLatest');
    const dbLatestRaw = await bingoModel.getMaxSeq();
    console.timeEnd('syncLatest:getDbLatest');

    const { maxSeq } = normalizeMaxSeq(dbLatestRaw);
    LOG.info('syncLatest: db maxSeq =', maxSeq);

    // 2) 원격 최신 회차 (v1 -> v2 -> probe)
    let remoteLatest = 0;
    try {
      console.time('syncLatest:fetchLatestRound_v1');
      remoteLatest = await retry(() => fetchLatestRound_v1(maxSeq), { retries: 1, baseDelay: 500 });
      console.timeEnd('syncLatest:fetchLatestRound_v1');
    } catch (e1) {
      LOG.warn('syncLatest: v1 failed -> fallback v2. reason =', e1?.message);
      try {
        console.time('syncLatest:fetchLatestRound_v2');
        remoteLatest = await retry(() => fetchLatestRound_v2(), { retries: 1, baseDelay: 500 });
        console.timeEnd('syncLatest:fetchLatestRound_v2');
      } catch (e2) {
        LOG.warn('syncLatest: v2 failed -> fallback probe. reason =', e2?.message);
        console.time('syncLatest:probeLatestByWalkingFrom');
        remoteLatest = await probeLatestByWalkingFrom(maxSeq, 30);
        console.timeEnd('syncLatest:probeLatestByWalkingFrom');
      }
    }
    LOG.info('syncLatest: remoteLatest =', remoteLatest);

    if (!Number.isInteger(remoteLatest) || remoteLatest <= 0) {
      throw new Error('invalid remoteLatest');
    }

    // 3) 누락 회차 수집/업서트
    if (remoteLatest > maxSeq) {
      const missingCount = remoteLatest - maxSeq;
      LOG.info(`syncLatest: missing rounds = ${missingCount} (${maxSeq + 1}..${remoteLatest})`);

      // 새로운 범위 조회 API 사용
      console.time('syncLatest:fetchRoundsRange');
      let results = [];
      try {
        results = await retry(
          () => fetchRoundsRange(maxSeq + 1, remoteLatest),
          { retries: 2, baseDelay: 500 }
        );
      } catch (e) {
        LOG.warn('fetchRoundsRange failed, falling back to individual fetch:', e.message);
        
        // 폴백: 개별 조회
        const limit = pLimit(3);
        const tasks = [];
        for (let r = maxSeq + 1; r <= remoteLatest; r++) {
          tasks.push(
            limit(async () => {
              try {
                const d = await retry(() => fetchRoundDetail(r), { retries: 2, baseDelay: 400 });
                return d;
              } catch (err) {
                LOG.err('syncLatest: fetchRoundDetail failed', r, err?.message);
                throw err;
              }
            })
          );
        }
        const settled = await Promise.allSettled(tasks);
        results = settled.filter(s => s.status === 'fulfilled').map(s => s.value);
      }
      console.timeEnd('syncLatest:fetchRoundsRange');

      LOG.info('syncLatest: results count =', results.length);

      console.time('syncLatest:upserts');
      let ok = 0;
      for (const detail of results) {
        try {
          if (typeof bingoModel.setUpsert === 'function') {
            if (bingoModel.setUpsert.length >= 2) {
              await bingoModel.setUpsert(detail.seq, detail);
            } else {
              await bingoModel.setUpsert(detail);
            }
          } else if (typeof bingoModel.upsertBySeq === 'function') {
            await bingoModel.upsertBySeq(detail.seq, detail);
          } else {
            throw new Error('No upsert function found on model');
          }
          ok++;
          if (DEBUG && ok <= 3) LOG.dbg('syncLatest: upserted', brief(detail));
        } catch (e) {
          LOG.err('syncLatest: upsert failed seq=', detail?.seq, e?.message);
        }
      }
      console.timeEnd('syncLatest:upserts');
      LOG.info(`syncLatest: upsert done ok=${ok}/${results.length}`);

      console.timeEnd('syncLatest');
      return {
        running: false,
        updated: results.length,
        range: `${maxSeq + 1}..${remoteLatest}`,
      };
    }

    // 4) 최신과 동일: 검증/보정
    if (remoteLatest === maxSeq) {
      LOG.info('syncLatest: already up to date; verifying the latest row...');
      try {
        console.time('syncLatest:verify-latest');
        const detail = await retry(() => fetchRoundDetailFromHtml(maxSeq), { retries: 1, baseDelay: 500 });
        if (typeof bingoModel.setUpsert === 'function') {
          if (bingoModel.setUpsert.length >= 2) {
            await bingoModel.setUpsert(detail.seq, detail);
          } else {
            await bingoModel.setUpsert(detail);
          }
        } else if (typeof bingoModel.upsertBySeq === 'function') {
          await bingoModel.upsertBySeq(detail.seq, detail);
        }
        console.timeEnd('syncLatest:verify-latest');
        LOG.info('syncLatest: verification/upsert done for seq', maxSeq);
      } catch (e) {
        LOG.warn('syncLatest: verification skipped/failed:', e?.message);
      }
      console.timeEnd('syncLatest');
      return { running: false, updated: 0, range: null };
    }

    // remoteLatest < dbLatest (비정상 케이스) → 무시
    LOG.warn('syncLatest: remoteLatest < dbLatest (ignore)');
    console.timeEnd('syncLatest');
    return { running: false, updated: 0, range: null };

  } catch (err) {
    LOG.err('syncLatest: fatal:', err?.message);
    console.timeEnd('syncLatest');
    throw err;
  } finally {
    syncing = false;
    LOG.dbg('syncLatest: done - lock released');
  }
}

module.exports = {
  syncLatest
};