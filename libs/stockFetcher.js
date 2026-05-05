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

        // 장 마감 전 당일 row는 close=null이므로 제외
        return result.quotes
            .filter(row => row.close !== null)
            .map(row => ({
                date: row.date.toISOString().split('T')[0],
                open: row.open,
                high: row.high,
                low: row.low,
                close: row.close,
                volume: row.volume
            }));
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
