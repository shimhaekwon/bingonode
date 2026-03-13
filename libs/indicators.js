// libs/indicators.js
/**
 * Technical Analysis Indicators Module
 * - Implements 9 technical indicators using trading-signals library
 * - Each indicator calculates predicted rise/fall % separately
 */

const {
    SMA, EMA, RSI, MACD, BollingerBands, ATR
} = require('trading-signals');
const ChartPatternEngine = require('./chartPatterns');

class IndicatorEngine {
    constructor() {
        this.indicators = {};
        this.chartPatternEngine = new ChartPatternEngine();
    }

    /**
     * Calculate Simple Moving Average
     * @param {number[]} prices - Array of closing prices
     * @param {number} period - Period for SMA
     * @returns {number[]} SMA values
     */
    calculateSMA(prices, period) {
        const sma = new SMA(period);
        const results = [];
        
        for (const price of prices) {
            // add() returns the result directly, or null if not enough data
            const result = sma.add(price);
            results.push(result);
        }
        
        return results;
    }

    /**
     * Calculate Exponential Moving Average
     * @param {number[]} prices - Array of closing prices
     * @param {number} period - Period for EMA
     * @returns {number[]} EMA values
     */
    calculateEMA(prices, period) {
        const ema = new EMA(period);
        const results = [];
        
        for (const price of prices) {
            const result = ema.add(price);
            results.push(result);
        }
        
        return results;
    }

    /**
     * Calculate RSI (Relative Strength Index)
     * @param {number[]} prices - Array of closing prices
     * @param {number} period - Period for RSI (default 14)
     * @returns {number[]} RSI values
     */
    calculateRSI(prices, period = 14) {
        const rsi = new RSI(period);
        const results = [];
        
        for (const price of prices) {
            const result = rsi.add(price);
            results.push(result);
        }
        
        return results;
    }

    /**
     * Calculate MACD
     * @param {number[]} prices - Array of closing prices
     * @returns {Object} MACD values {macd, signal, histogram}
     */
    calculateMACD(prices) {
        // MACD requires EMA instances for fast, slow, and signal
        const macd = new MACD(new EMA(12), new EMA(26), new EMA(9));
        const results = { macd: [], signal: [], histogram: [] };
        
        for (const price of prices) {
            const result = macd.add(price);
            if (result) {
                results.macd.push(result.macd);
                results.signal.push(result.signal);
                results.histogram.push(result.histogram);
            } else {
                results.macd.push(null);
                results.signal.push(null);
                results.histogram.push(null);
            }
        }
        
        return results;
    }

    /**
     * Calculate Bollinger Bands
     * @param {number[]} prices - Array of closing prices
     * @param {number} period - Period for BB (default 20)
     * @param {number} stdDev - Standard deviations (default 2)
     * @returns {Object} BB values {upper, middle, lower, percentB}
     */
    calculateBollingerBands(prices, period = 20, stdDev = 2) {
        const bb = new BollingerBands(period, stdDev);
        const results = { upper: [], middle: [], lower: [], percentB: [] };
        
        for (const price of prices) {
            const result = bb.add(price);
            if (result) {
                results.upper.push(result.upper);
                results.middle.push(result.middle);
                results.lower.push(result.lower);
                results.percentB.push(result.percentB);
            } else {
                results.upper.push(null);
                results.middle.push(null);
                results.lower.push(null);
                results.percentB.push(null);
            }
        }
        
        return results;
    }

    /**
     * Calculate ATR (Average True Range)
     * @param {Object[]} data - Array of {high, low, close}
     * @param {number} period - Period for ATR (default 14)
     * @returns {number[]} ATR values
     */
    calculateATR(data, period = 14) {
        const atr = new ATR(period);
        const results = [];
        
        for (const candle of data) {
            // ATR requires {high, low, close}
            const result = atr.add({ high: candle.high, low: candle.low, close: candle.close });
            results.push(result);
        }
        
        return results;
    }

    /**
     * Run all indicators on the data
     * @param {Array} data - Array of {date, open, high, low, close, volume}
     * @returns {Object} - {analyzedData, predictions}
     */
    async runAnalysis(data) {
        const prices = data.map(d => d.close);
        const predictions = {};

        try {
            // SMA 5/20
            const sma5 = this.calculateSMA(prices, 5);
            const sma20 = this.calculateSMA(prices, 20);
            predictions.sma_5_20 = this.predictSMA(prices, sma5, sma20);

            // SMA 5/50
            const sma50 = this.calculateSMA(prices, 50);
            predictions.sma_5_50 = this.predictSMA(prices, sma5, sma50);

            // SMA 20/50
            predictions.sma_20_50 = this.predictSMA(prices, sma20, sma50);

            // EMA 12/26
            const ema12 = this.calculateEMA(prices, 12);
            const ema26 = this.calculateEMA(prices, 26);
            predictions.ema_12_26 = this.predictEMA(prices, ema12, ema26);

            // RSI
            const rsi = this.calculateRSI(prices, 14);
            predictions.rsi_14 = this.predictRSI(rsi);

            // MACD
            const macd = this.calculateMACD(prices);
            predictions.macd = this.predictMACD(macd);

            // Bollinger Bands
            const bb = this.calculateBollingerBands(prices, 20, 2);
            predictions.bollinger = this.predictBollinger(prices, bb);

            // ATR (volatility only, no direction prediction)
            predictions.atr = 0;

            // Momentum
            predictions.momentum = this.predictMomentum(prices);

            // Volume (simplified)
            predictions.volume = this.predictVolume(data);

            // Chart Patterns (Candlestick patterns)
            const { predictions: chartPredictions } = await this.chartPatternEngine.runAnalysis(data);
            for (const [pattern, strength] of Object.entries(chartPredictions)) {
                predictions[`pattern_${pattern}`] = strength;
            }

        } catch (error) {
            console.error('[ERROR] Indicator calculation failed:', error.message);
        }

        return { predictions };
    }

    // ==================== Prediction Methods ====================

    predictSMA(prices, smaShort, smaLong) {
        const len = prices.length;
        if (len < 20 || !smaShort[len - 1] || !smaLong[len - 1]) {
            return 0;
        }

        const currentPrice = prices[len - 1];
        const currentSmaShort = smaShort[len - 1];
        const currentSmaLong = smaLong[len - 1];
        const prevSmaShort = smaShort[len - 2] || currentSmaShort;
        const prevSmaLong = smaLong[len - 2] || currentSmaLong;

        let predictedChange = 0;

        // Golden cross
        if (prevSmaShort <= prevSmaLong && currentSmaShort > currentSmaLong) {
            predictedChange = 2.0;
        }
        // Death cross
        else if (prevSmaShort >= prevSmaLong && currentSmaShort < currentSmaLong) {
            predictedChange = -2.0;
        }
        else {
            // Price vs SMA deviation
            const deviation = (currentPrice - currentSmaShort) / currentSmaShort * 100;
            predictedChange = deviation * 0.3;
        }

        return predictedChange;
    }

    predictEMA(prices, emaShort, emaLong) {
        const len = prices.length;
        if (len < 26 || !emaShort[len - 1] || !emaLong[len - 1]) {
            return 0;
        }

        const currentPrice = prices[len - 1];
        const currentEmaShort = emaShort[len - 1];
        const currentEmaLong = emaLong[len - 1];
        const prevEmaShort = emaShort[len - 2] || currentEmaShort;
        const prevEmaLong = emaLong[len - 2] || currentEmaLong;

        let predictedChange = 0;

        if (prevEmaShort <= prevEmaLong && currentEmaShort > currentEmaLong) {
            predictedChange = 2.5;
        }
        else if (prevEmaShort >= prevEmaLong && currentEmaShort < currentEmaLong) {
            predictedChange = -2.5;
        }
        else {
            const deviation = (currentPrice - currentEmaShort) / currentEmaShort * 100;
            predictedChange = deviation * 0.3;
        }

        return predictedChange;
    }

    predictRSI(rsiValues) {
        const len = rsiValues.length;
        const lastRsi = rsiValues[len - 1];
        
        if (lastRsi === null || lastRsi === undefined) {
            return 0;
        }

        if (lastRsi < 30) {
            return (30 - lastRsi) * 0.15;
        }
        else if (lastRsi > 70) {
            return -(lastRsi - 70) * 0.15;
        }
        else {
            return (50 - lastRsi) * 0.02;
        }
    }

    predictMACD(macdData) {
        const len = macdData.macd.length;
        const macd = macdData.macd[len - 1];
        const signal = macdData.signal[len - 1];
        const hist = macdData.histogram[len - 1];
        
        const prevMacd = macdData.macd[len - 2] || macd;
        const prevSignal = macdData.signal[len - 2] || signal;

        if (macd === null || signal === null) {
            return 0;
        }

        let predictedChange = 0;

        if (prevMacd <= prevSignal && macd > signal) {
            predictedChange = 2.5;
        }
        else if (prevMacd >= prevSignal && macd < signal) {
            predictedChange = -2.5;
        }
        else {
            if (hist !== null) {
                predictedChange = Math.sign(hist) * Math.min(Math.abs(hist) * 2, 3);
            }
        }

        return predictedChange;
    }

    predictBollinger(prices, bbData) {
        const len = bbData.upper.length;
        const price = prices[len - 1];
        const upper = bbData.upper[len - 1];
        const lower = bbData.lower[len - 1];
        const pctB = bbData.percentB[len - 1];

        if (price === null || upper === null || lower === null || upper === lower) {
            return 0;
        }

        if (pctB < 0) {
            return Math.abs(pctB) * 3;
        }
        else if (pctB > 1) {
            return -(pctB - 1) * 3;
        }
        else {
            return (0.5 - pctB) * 1;
        }
    }

    predictMomentum(prices) {
        const periods = [5, 10, 20];
        const weights = [0.5, 0.3, 0.2];
        
        let predictedChange = 0;
        
        for (let i = 0; i < periods.length; i++) {
            const p = periods[i];
            if (prices.length > p) {
                const mom = (prices[prices.length - 1] - prices[prices.length - 1 - p]) / prices[prices.length - 1 - p] * 100;
                predictedChange += mom * weights[i];
            }
        }

        return predictedChange * 0.3;
    }

    predictVolume(data) {
        if (data.length < 20) return 0;

        const volumes = data.map(d => d.volume);
        const avgVolume = volumes.slice(0, -1).reduce((a, b) => a + b, 0) / (volumes.length - 1);
        const currentVolume = volumes[volumes.length - 1];
        const volumeRatio = currentVolume / avgVolume;

        const priceChange = data[data.length - 1].close - data[data.length - 2].close;

        if (volumeRatio > 1.5) {
            return Math.sign(priceChange) * volumeRatio * 0.5;
        }

        return 0;
    }
}

module.exports = IndicatorEngine;
