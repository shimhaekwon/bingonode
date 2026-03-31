// services/stockService.js
/**
 * Stock Prediction Service
 * - Coordinates data fetching and technical analysis
 * - Implements the same workflow as Python predictor.py
 */

const StockFetcher = require('@libs/stockFetcher');
const IndicatorEngine = require('@libs/indicators');
const KOREAN_STOCKS = require('@config/stocks');

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
     * Calculate directional hit rate for each technique over a walk-forward window
     * Ref: walk-forward validation / hit rate (stock-prediction-composite-strategies.md)
     * @param {Array} data - Full OHLCV data array
     * @param {number} trainingDays - Training window size
     * @param {number} hitDays - Number of days to test direction accuracy (default 20)
     * @returns {Object} - {technique: hitRate (0~1)}
     */
    async calculateHitRates(data, trainingDays, hitDays = 20) {
        const hitCount = {};
        const totalCount = {};

        for (let offset = hitDays; offset >= 1; offset--) {
            if (data.length < trainingDays + offset + 1) continue;

            const trainData = data.slice(-(trainingDays + offset), -offset);
            const dayActual = this.calculateActualChange(data, -offset);
            if (dayActual === 0) continue;

            const { predictions: dayPredictions } = await this.indicatorEngine.runAnalysis(trainData);

            for (const [technique, predicted] of Object.entries(dayPredictions)) {
                totalCount[technique] = (totalCount[technique] || 0) + 1;
                if (Math.sign(predicted) === Math.sign(dayActual)) {
                    hitCount[technique] = (hitCount[technique] || 0) + 1;
                }
            }
        }

        const hitRates = {};
        for (const technique of Object.keys(totalCount)) {
            hitRates[technique] = totalCount[technique] > 0
                ? (hitCount[technique] || 0) / totalCount[technique]
                : 0.5;
        }
        return hitRates;
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
            return { success: false, error: 'Insufficient data', ticker };
        }

        // Full data for final next-day prediction
        const fullData = data;

        // Multi-day validation: average similarity over last VALIDATION_DAYS days
        // Reduces single-sample noise (ref: walk-forward validation approach)
        const VALIDATION_DAYS = 5;
        const similarityAccum = {};
        let actualChange = 0;

        for (let offset = VALIDATION_DAYS; offset >= 1; offset--) {
            // trainData excludes the day being validated
            const trainData = data.slice(-(trainingDays + offset), -offset);
            const dayActual = this.calculateActualChange(data, -offset);
            const { predictions: dayPredictions } = await this.indicatorEngine.runAnalysis(trainData);

            for (const [technique, predicted] of Object.entries(dayPredictions)) {
                const sim = this.calculateSimilarity(predicted, dayActual);
                similarityAccum[technique] = (similarityAccum[technique] || 0) + sim;
            }

            if (offset === 1) actualChange = dayActual; // keep last day's actual for display
        }

        // Average similarities across VALIDATION_DAYS
        const similarities = {};
        for (const [technique, total] of Object.entries(similarityAccum)) {
            similarities[technique] = total / VALIDATION_DAYS;
        }

        // Run analysis on training window (excludes last day) for predictions reference
        const trainData = data.slice(-(trainingDays + 1), -1);
        const { predictions } = await this.indicatorEngine.runAnalysis(trainData);

        // Filter passed techniques by averaged similarity threshold
        const passed = Object.entries(similarities)
            .filter(([, sim]) => sim >= threshold)
            .map(([technique]) => technique);

        // Walk-forward hit rate over 20 days (directional accuracy per technique)
        // weight = similarity × (0.5 + 0.5 × hitRate) — combines magnitude + direction reliability
        const hitRates = await this.calculateHitRates(data, trainingDays, 20);

        // Rank techniques by similarity
        const ranked = this.rankTechniques(similarities);

        // Predict next day using passed techniques
        const { predictions: nextPredictions } = await this.indicatorEngine.runAnalysis(fullData);

        const finalPredictions = {};
        for (const technique of passed) {
            finalPredictions[technique] = nextPredictions[technique] || 0;
        }

        // Calculate final prediction (weighted by similarity × hit rate)
        let nextDayPrediction = 0;
        if (Object.keys(finalPredictions).length > 0) {
            let weightedSum = 0;
            let weightSum = 0;
            for (const technique of Object.keys(finalPredictions)) {
                const sim = similarities[technique] || 0;
                const hitRate = hitRates[technique] !== undefined ? hitRates[technique] : 0.5;
                const weight = sim * (0.5 + 0.5 * hitRate);
                weightedSum += finalPredictions[technique] * weight;
                weightSum += weight;
            }
            nextDayPrediction = weightSum > 0 ? weightedSum / weightSum : 0;
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
            hit_rates: hitRates,
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
        const settled = await Promise.allSettled(
            KOREAN_STOCKS.map(stock => this.predict(stock.ticker, trainingDays, threshold))
        );

        return settled.map((result, i) => {
            if (result.status === 'fulfilled') return result.value;
            return {
                ticker: KOREAN_STOCKS[i].ticker,
                name: KOREAN_STOCKS[i].name,
                error: result.reason?.message || 'Unknown error',
                success: false
            };
        });
    }
}

module.exports = StockService;
