// libs/stockFetcher.js
/**
 * Stock Data Fetcher Module
 * - 3단계 캐시: 인메모리 TTL → SQLite (stock_data) → yfinance
 * - C 패턴: DB가 stale이면 yfinance에서 가져와 DB 업서트 후 반환
 * - yfinance 실패 시 stale DB 데이터로 폴백
 */

const YahooFinance = require('yahoo-finance2').default;
const KOREAN_STOCKS = require('@config/stocks');
const stockModel = require('@models/stockModel.js');

const CACHE_TTL_MS = 5 * 60 * 1000; // 5분 인메모리 TTL

/**
 * yfinance row 정규화. 진행 중 기간(부분 월/주봉)은 close 만 채워지고
 * open/high/low 가 0 으로 오는 경우가 있음. close>0 이고 OHL 중 하나라도 <=0 이면
 * 4개 모두 close 로 채워(degenerate doji) 다운스트림 집계/마커 계산에서 0 division 방지.
 * 완전 무효(close 도 0/null) row 는 호출처에서 필터.
 */
function normalizeOhlcv(row) {
    if (!row || !row.date) return null;
    const c = row.close;
    if (c == null || !(c > 0)) {
        // close 자체가 없으면 정규화 불가 — 호출처가 필터링
        return {
            date: row.date.toISOString().split('T')[0],
            open: row.open, high: row.high, low: row.low, close: row.close,
            volume: row.volume
        };
    }
    let o = row.open, h = row.high, l = row.low;
    if (!(o > 0) || !(h > 0) || !(l > 0)) {
        o = c; h = c; l = c;
    }
    return {
        date: row.date.toISOString().split('T')[0],
        open: o, high: h, low: l, close: c,
        volume: row.volume || 0
    };
}

// 캔들 주기별 Yahoo interval + 조회 기간 (년 단위).
// Y(년봉)는 Yahoo가 yearly 미지원 → 월봉(1mo)을 받아 서버에서 연 단위 집계.
const INTERVAL_MAP = {
    D: { yahoo: '1d',  yearsBack: 1  },
    W: { yahoo: '1wk', yearsBack: 5  },
    M: { yahoo: '1mo', yearsBack: 20 },
    Y: { yahoo: '1mo', yearsBack: 40, aggregate: 'year' },
};

class StockFetcher {
    constructor() {
        this.cache = {}; // { ticker_days: { data, expireAt } }
        this.yf = new YahooFinance({ suppressNotices: ['ripHistorical'] });
    }

    getStockList() {
        return KOREAN_STOCKS.map(s => ({ ...s }));
    }

    /**
     * DB max_date가 오늘(KST)이면 fresh — 추가 fetch 불필요.
     * 주말/공휴일에는 max_date가 금요일인 채로 fresh가 아니지만, 그 경우
     * yfinance도 새 데이터를 반환하지 않으므로 호출 1회만 낭비됨 (5분 캐시로 throttle).
     */
    isDbFresh(maxDate) {
        if (!maxDate) return false;
        const todayKst = new Date(Date.now() + 9 * 60 * 60 * 1000)
            .toISOString().split('T')[0];
        return maxDate >= todayKst;
    }

    /**
     * yfinance에서 직접 데이터 가져오기.
     * @returns {Array|null} OHLCV 배열 (oldest-first) 또는 null
     */
    async fetchFromYahoo(ticker, periodDays) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - periodDays);

        const result = await this.yf.chart(ticker, {
            period1: startDate.toISOString().split('T')[0],
            period2: endDate.toISOString().split('T')[0],
            interval: '1d'
        });

        if (!result || !result.quotes || result.quotes.length === 0) {
            return null;
        }

        // 장 마감 전 당일 row는 close=null 또는 OHL=0 으로 올 수 있음 → 정규화 + 필터
        return result.quotes
            .map(row => normalizeOhlcv(row))
            .filter(row => row && row.close > 0);
    }

    /**
     * 메인 진입점. 인메모리 → DB → yfinance 순으로 캐시 활용.
     * @param {string} ticker
     * @param {number} periodDays
     * @returns {Promise<Array|null>} OHLCV 배열 (oldest-first)
     */
    async fetch(ticker, periodDays = 400) {
        // [Layer 1] 인메모리 TTL
        const cacheKey = `${ticker}_${periodDays}`;
        const cached = this.cache[cacheKey];
        if (cached && cached.expireAt > Date.now()) {
            return cached.data;
        }

        // [Layer 2] DB freshness 검사
        let maxDate = null;
        try {
            maxDate = await stockModel.getMaxDate(ticker);
        } catch (e) {
            console.warn(`[stockFetcher] getMaxDate failed for ${ticker}:`, e.message);
        }

        if (this.isDbFresh(maxDate)) {
            const data = await stockModel.getRange(ticker, periodDays);
            this.cache[cacheKey] = { data, expireAt: Date.now() + CACHE_TTL_MS };
            return data;
        }

        // [Layer 3] yfinance에서 fresh fetch
        try {
            const fresh = await this.fetchFromYahoo(ticker, periodDays);
            if (fresh && fresh.length > 0) {
                // DB에 upsert (보정 이벤트도 반영)
                try {
                    await stockModel.upsertMany(ticker, fresh);
                } catch (e) {
                    console.warn(`[stockFetcher] upsert failed for ${ticker}:`, e.message);
                }
                // DB에서 다시 읽어 일관된 형식 보장
                const data = await stockModel.getRange(ticker, periodDays);
                const finalData = data.length ? data : fresh;
                this.cache[cacheKey] = { data: finalData, expireAt: Date.now() + CACHE_TTL_MS };
                return finalData;
            }
            // yfinance가 빈 응답이면 stale DB라도 반환
            if (maxDate) {
                console.warn(`[stockFetcher] yfinance returned empty for ${ticker}, using stale DB`);
                const data = await stockModel.getRange(ticker, periodDays);
                this.cache[cacheKey] = { data, expireAt: Date.now() + CACHE_TTL_MS };
                return data;
            }
            console.warn(`[stockFetcher] No data anywhere for ${ticker}`);
            return null;
        } catch (error) {
            // yfinance 실패 → stale DB 폴백
            if (maxDate) {
                console.warn(`[stockFetcher] yfinance failed for ${ticker} (${error.message}), using stale DB`);
                try {
                    const data = await stockModel.getRange(ticker, periodDays);
                    return data;
                } catch (e) {
                    console.error(`[stockFetcher] DB fallback also failed for ${ticker}:`, e.message);
                    return null;
                }
            }
            console.error(`[stockFetcher] Failed to fetch ${ticker}:`, error.message);
            return null;
        }
    }

    /**
     * 캔들 주기 기반 데이터 조회 (일봉/주봉/월봉/년봉).
     * D: 기존 daily 3-tier 캐시(DB) 재사용. W/M: Yahoo native interval.
     * Y: 월봉을 받아 연 단위 집계. 5분 인메모리 캐시.
     * @param {string} ticker
     * @param {'D'|'W'|'M'|'Y'} period
     * @returns {Promise<Array>} OHLCV 배열 (oldest-first)
     */
    async fetchCandles(ticker, period = 'D') {
        const cfg = INTERVAL_MAP[period];
        if (!cfg) throw new Error(`Invalid period: ${period}`);

        const cacheKey = `candles_${ticker}_${period}`;
        const cached = this.cache[cacheKey];
        if (cached && cached.expireAt > Date.now()) return cached.data;

        // D: 기존 daily 경로 (DB 캐시 활용 + predict 와 동일 데이터)
        if (period === 'D') {
            const daily = (await this.fetch(ticker, 400)) || [];
            this.cache[cacheKey] = { data: daily, expireAt: Date.now() + CACHE_TTL_MS };
            return daily;
        }

        // W/M/Y: Yahoo native interval 직접 호출 (DB는 daily-only 이므로 미저장)
        try {
            const raw = await this._fetchYahooCandles(ticker, cfg);
            const result = cfg.aggregate === 'year' ? this._aggregateToYearly(raw) : raw;
            this.cache[cacheKey] = { data: result, expireAt: Date.now() + CACHE_TTL_MS };
            return result;
        } catch (error) {
            console.warn(`[stockFetcher] fetchCandles ${ticker} ${period} Yahoo failed: ${error.message}`);
            // 폴백: 보유 daily DB 에서 집계 (제한적이나 빈 응답보다 나음)
            try {
                const daily = await stockModel.getRange(ticker, 100000);
                return this._aggregateFromDaily(daily, period);
            } catch (e2) {
                console.error(`[stockFetcher] fetchCandles fallback failed for ${ticker}:`, e2.message);
                return [];
            }
        }
    }

    async _fetchYahooCandles(ticker, cfg) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - cfg.yearsBack);
        const result = await this.yf.chart(ticker, {
            period1: startDate.toISOString().split('T')[0],
            period2: endDate.toISOString().split('T')[0],
            interval: cfg.yahoo
        });
        if (!result || !result.quotes || result.quotes.length === 0) return [];
        return result.quotes
            .map(row => normalizeOhlcv(row))
            .filter(row => row && row.close > 0 && row.date);
    }

    // 월봉 → 년봉: 연도별 그룹화. open=첫달 open, close=마지막달 close, high=max, low=min, volume=sum.
    _aggregateToYearly(monthly) {
        if (!monthly || monthly.length === 0) return [];
        const byYear = new Map();
        for (const m of monthly) {
            const year = m.date.slice(0, 4);
            if (!byYear.has(year)) byYear.set(year, []);
            byYear.get(year).push(m);
        }
        const out = [];
        for (const [year, months] of byYear) {
            months.sort((a, b) => a.date.localeCompare(b.date));
            const first = months[0];
            const last = months[months.length - 1];
            out.push({
                date: `${year}-01-01`,
                open: first.open,
                high: Math.max(...months.map(m => m.high)),
                low: Math.min(...months.map(m => m.low)),
                close: last.close,
                volume: months.reduce((s, m) => s + (m.volume || 0), 0),
            });
        }
        return out.sort((a, b) => a.date.localeCompare(b.date));
    }

    // 일봉 → W/M/Y 집계 (Yahoo 폴백용). 보유 일봉이 얕으면 결과도 얕음.
    _aggregateFromDaily(daily, period) {
        if (!daily || daily.length === 0) return [];
        if (period === 'D') return daily;
        const bucketKey = (dateStr) => {
            if (period === 'W') {
                const d = new Date(dateStr + 'T00:00:00Z');
                d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // 일요일 시작
                return d.toISOString().split('T')[0];
            }
            if (period === 'M') return dateStr.slice(0, 7) + '-01';
            if (period === 'Y') return dateStr.slice(0, 4) + '-01-01';
            return dateStr;
        };
        const buckets = new Map();
        for (const d of daily) {
            const key = bucketKey(d.date);
            if (!buckets.has(key)) buckets.set(key, []);
            buckets.get(key).push(d);
        }
        const out = [];
        for (const [key, rows] of buckets) {
            rows.sort((a, b) => a.date.localeCompare(b.date));
            out.push({
                date: key,
                open: rows[0].open,
                high: Math.max(...rows.map(r => r.high)),
                low: Math.min(...rows.map(r => r.low)),
                close: rows[rows.length - 1].close,
                volume: rows.reduce((s, r) => s + (r.volume || 0), 0),
            });
        }
        return out.sort((a, b) => a.date.localeCompare(b.date));
    }

    async fetchMultiple(tickers = null, periodDays = 400) {
        if (!tickers) tickers = KOREAN_STOCKS.map(s => s.ticker);
        const settled = await Promise.allSettled(
            tickers.map(ticker => this.fetch(ticker, periodDays))
        );
        const results = {};
        settled.forEach((result, i) => {
            if (result.status === 'fulfilled' && result.value) {
                results[tickers[i]] = result.value;
            }
        });
        return results;
    }
}

module.exports = StockFetcher;
