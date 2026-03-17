// libs/stockFetcher.js
/**
 * Stock Data Fetcher Module
 * - Fetches OHLCV data from Yahoo Finance using yahoo-finance2
 * - Supports Korean stocks with KRX format
 */

const YahooFinance = require('yahoo-finance2').default;

// Korean stock tickers (same as Python version)
const KOREAN_STOCKS = [
    { ticker: "005930.KS", name: "Samsung Electronics" },
    { ticker: "000660.KS", name: "SK Hynix" },
    { ticker: "035420.KS", name: "NAVER" },
    { ticker: "051910.KS", name: "LG Energy Solution" },
    { ticker: "006400.KS", name: "Samsung SDI" },
    { ticker: "005490.KS", name: "POSCO Holdings" },
    { ticker: "035720.KS", name: "Kakao" },
    { ticker: "012330.KS", name: "Hyundai Mobis" },
    { ticker: "000270.KS", name: "Kia" },
    { ticker: "068270.KS", name: "Celltrion" },
];

class StockFetcher {
    constructor() {
        this.cache = {};
        // Suppress the deprecation notice for historical()
        this.yf = new YahooFinance({ suppressNotices: ['ripHistorical'] });
    }

    /**
     * Get list of available Korean stock tickers
     * @returns {Array} Array of stock objects with ticker and name
     */
    getStockList() {
        return KOREAN_STOCKS.map(s => ({ ...s }));
    }

    /**
     * Fetch OHLCV data for a given ticker
     * @param {string} ticker - Stock ticker (e.g., "005930.KS")
     * @param {number} periodDays - Number of days to fetch (default: 400)
     * @returns {Promise<Array|null>} Array of OHLCV objects or null on error
     */
    async fetch(ticker, periodDays = 400) {
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - periodDays);

            // Use chart() instead of deprecated historical()
            const result = await this.yf.chart(ticker, {
                period1: startDate.toISOString().split('T')[0],
                period2: endDate.toISOString().split('T')[0],
                interval: '1d'
            });

            if (!result || !result.quotes || result.quotes.length === 0) {
                console.warn(`[WARN] No data for ${ticker}`);
                return null;
            }

            // Transform to match expected format (data comes oldest-first from Yahoo)
            // Filter out rows with null close values (usually current day before market closes)
            const data = result.quotes
                .filter(row => row.close !== null)
                .map(row => ({
                    date: row.date.toISOString().split('T')[0],
                    open: row.open,
                    high: row.high,
                    low: row.low,
                    close: row.close,
                    volume: row.volume
                }));

            return data;
        } catch (error) {
            console.error(`[ERROR] Failed to fetch ${ticker}:`, error.message);
            return null;
        }
    }

    /**
     * Fetch data for multiple tickers
     * @param {Array} tickers - Array of ticker strings (uses KOREAN_STOCKS if null)
     * @param {number} periodDays - Number of days to fetch
     * @returns {Promise<Object>} Dict of {ticker: dataArray}
     */
    async fetchMultiple(tickers = null, periodDays = 400) {
        if (!tickers) {
            tickers = KOREAN_STOCKS.map(s => s.ticker);
        }

        const results = {};
        for (const ticker of tickers) {
            const data = await this.fetch(ticker, periodDays);
            if (data) {
                results[ticker] = data;
            }
        }
        return results;
    }
}

module.exports = StockFetcher;
