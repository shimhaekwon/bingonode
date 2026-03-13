// services/stockService.js
/**
 * Stock Prediction Service
 * - Coordinates data fetching and technical analysis
 * - Implements the same workflow as Python predictor.py
 */

const StockFetcher = require('@libs/stockFetcher');
const IndicatorEngine = require('@libs/indicators');

// Korean stock list (same as fetcher)
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

class StockService {
    constructor() {
        this.fetcher = new StockFetcher();
        this.indicatorEngine = new IndicatorEngine();
    }

    /**
     * Get list of available stocks
     */
    getStockList() {
        return KOREAN_STOCKS;
    }

    /**
     * Get stock data for chart display
     * @param {string} ticker - Stock ticker
     * @param {number} days - Number of days to fetch
     * @returns {Array} OHLCV data array
     */
    async getStockData(ticker, days = 365) {
        const data = await this.fetcher.fetch(ticker, days);
        return data;
    }

    /**
     * Calculate actual change percentage for a specific day
     * @param {Array} data - OHLCV data array
     * @param {number} dayOffset - -1 = last day, -2 = second to last, etc.
     * @returns {number} Actual change percentage
     */
    calculateActualChange(data, dayOffset = -1) {
        if (data.length < 2) return 0;

        const currentIdx = data.length + dayOffset;
        const prevIdx = currentIdx - 1;

        if (prevIdx < 0) return 0;

        const currentClose = data[currentIdx].close;
        const prevClose = data[prevIdx].close;

        if (prevClose === 0) return 0;

        return (currentClose - prevClose) / prevClose * 100;
    }

    /**
     * Calculate similarity between predicted and actual
     * @param {number} predicted - Predicted change %
     * @param {number} actual - Actual change %
     * @returns {number} Similarity score (0 to 1)
     */
    calculateSimilarity(predicted, actual) {
        if (actual === 0) {
            return Math.abs(predicted) < 1 ? 0.5 : 0;
        }

        // Handle opposite directions
        if (Math.sign(predicted) !== Math.sign(actual)) {
            return Math.max(0, 1 - Math.abs(predicted - actual) / Math.abs(actual)) * 0.3;
        }

        // Same direction - calculate ratio similarity
        const ratio = Math.abs(predicted) / Math.abs(actual);
        const similarity = 1 - Math.abs(1 - ratio);
        return Math.max(0, similarity);
    }

    /**
     * Validate predictions against actual change
     * @param {Object} predictions - Dict of {technique: predicted%}
     * @param {number} actualChange - Actual change %
     * @param {number} threshold - Minimum similarity to pass (default 0.5)
     * @returns {Object} - {similarities, passed}
     */
    validate(predictions, actualChange, threshold = 0.5) {
        const similarities = {};
        const passed = [];

        for (const [technique, predicted] of Object.entries(predictions)) {
            const sim = this.calculateSimilarity(predicted, actualChange);
            similarities[technique] = sim;

            if (sim >= threshold) {
                passed.push(technique);
            }
        }

        return { similarities, passed };
    }

    /**
     * Rank techniques by similarity score
     * @param {Object} similarities - Dict of {technique: similarity}
     * @returns {Array} - Sorted array of [technique, similarity]
     */
    rankTechniques(similarities) {
        return Object.entries(similarities)
            .sort((a, b) => b[1] - a[1]);
    }

    /**
     * Run prediction for a single stock
     * @param {string} ticker - Stock ticker
     * @param {number} trainingDays - Days for training (default 240)
     * @param {number} threshold - Similarity threshold (default 0.5)
     * @returns {Object} Prediction result
     */
    async predict(ticker, trainingDays = 240, threshold = 0.5) {
        // Fetch data
        const data = await this.fetcher.fetch(ticker, 400);
        
        if (!data || data.length < trainingDays + 10) {
            return { error: 'Insufficient data', ticker };
        }

        // Split data: training (last N days excluding last day) and test (last day)
        const trainData = data.slice(-(trainingDays + 1), -1);
        const fullData = data;

        // Get actual change for last day
        const actualChange = this.calculateActualChange(data, -1);

        // Run analysis on training data
        const { predictions } = await this.indicatorEngine.runAnalysis(trainData);

        // Validate predictions against actual
        const { similarities, passed } = this.validate(predictions, actualChange, threshold);

        // Rank techniques
        const ranked = this.rankTechniques(similarities);

        // Predict next day using passed techniques
        const { predictions: nextPredictions } = await this.indicatorEngine.runAnalysis(fullData);
        
        const finalPredictions = {};
        for (const technique of passed) {
            finalPredictions[technique] = nextPredictions[technique] || 0;
        }

        // Calculate final prediction (average)
        let nextDayPrediction = 0;
        if (Object.keys(finalPredictions).length > 0) {
            const values = Object.values(finalPredictions);
            nextDayPrediction = values.reduce((a, b) => a + b, 0) / values.length;
        }

        // Get stock name
        const stock = KOREAN_STOCKS.find(s => s.ticker === ticker);
        const stockName = stock ? stock.name : ticker;

        return {
            ticker,
            name: stockName,
            last_date: data[data.length - 1].date,
            last_close: data[data.length - 1].close,
            actual_change: actualChange,
            training_days: trainData.length,
            all_predictions: predictions,
            all_similarities: similarities,
            passed_techniques: passed,
            ranked_techniques: ranked,
            best_technique: ranked[0] ? ranked[0][0] : null,
            best_similarity: ranked[0] ? ranked[0][1] : 0,
            next_day_prediction: nextDayPrediction,
            prediction_direction: nextDayPrediction > 0 ? 'UP' : nextDayPrediction < 0 ? 'DOWN' : 'FLAT'
        };
    }

    /**
     * Run prediction for all stocks
     * @param {number} trainingDays - Days for training
     * @param {number} threshold - Similarity threshold
     * @returns {Array} Array of prediction results
     */
    async predictAll(trainingDays = 240, threshold = 0.5) {
        const results = [];

        for (const stock of KOREAN_STOCKS) {
            try {
                const result = await this.predict(stock.ticker, trainingDays, threshold);
                results.push(result);
            } catch (error) {
                results.push({
                    ticker: stock.ticker,
                    name: stock.name,
                    error: error.message,
                    success: false
                });
            }
        }

        return results;
    }
}

module.exports = StockService;
