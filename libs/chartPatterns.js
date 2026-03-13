// libs/chartPatterns.js
/**
 * Chart Pattern Detection Module
 * - Implements candlestick pattern detection for technical analysis
 * - Phase 1: Single/Multi-candlestick patterns (Hammer, Doji, Engulfing, Morning/Evening Star)
 */

class ChartPatternEngine {
    constructor() {
        // Pattern strength multipliers for prediction
        this.patternStrength = {
            hammer: 2.0,
            inverted_hammer: 1.5,
            shooting_star: -2.0,
            hanging_man: -1.5,
            doji: 0.3,
            spinning_top: 0.2,
            bullish_engulfing: 3.0,
            bearish_engulfing: -3.0,
            morning_star: 3.5,
            evening_star: -3.5,
            piercing_line: 2.5,
            dark_cloud_cover: -2.5,
            bullish_harami: 1.8,
            bearish_harami: -1.8,
            three_white_soldiers: 3.0,
            three_black_crows: -3.0,
            double_top: -4.0,
            double_bottom: 4.0,
            head_and_shoulders: -4.0,
            inverse_head_and_shoulders: 4.0,
            rising_wedge: -3.0,
            falling_wedge: 3.0,
            bull_flag: 2.5,
            bear_flag: -2.5,
            ascending_triangle: 2.0,
            descending_triangle: -2.0,
            symmetrical_triangle: 0.5
        };
    }

    /**
     * Get OHLC data from array
     */
    getCandle(data, idx) {
        if (idx < 0 || idx >= data.length) return null;
        return data[idx];
    }

    /**
     * Calculate body and shadow values
     */
    analyzeCandle(candle) {
        if (!candle) return null;
        
        const body = candle.close - candle.open;
        const bodySize = Math.abs(body);
        const upperShadow = candle.high - Math.max(candle.close, candle.open);
        const lowerShadow = Math.min(candle.close, candle.open) - candle.low;
        const totalRange = candle.high - candle.low;
        
        return {
            body,
            bodySize,
            upperShadow,
            lowerShadow,
            totalRange,
            isBullish: body > 0,
            isBearish: body < 0,
            isDoji: bodySize < totalRange * 0.1,
            hasLongLowerShadow: lowerShadow > bodySize * 2,
            hasLongUpperShadow: upperShadow > bodySize * 2
        };
    }

    // ==================== Single Candle Patterns ====================

    /**
     * Hammer / Inverted Hammer
     * - Hammer: Long lower shadow (>= 2x body), small upper shadow
     * - Inverted Hammer: Long upper shadow, small lower shadow
     */
    detectHammer(data, idx = -1) {
        const candle = this.getCandle(data, idx);
        if (!candle) return { pattern: null, strength: 0 };

        const a = this.analyzeCandle(candle);
        
        // Hammer: lower shadow >= 2x body, small upper shadow
        if (a.hasLongLowerShadow && a.upperShadow < a.bodySize * 0.5 && a.bodySize > 0) {
            return { pattern: 'hammer', strength: this.patternStrength.hammer };
        }
        
        // Inverted Hammer: upper shadow >= 2x body, small lower shadow
        if (a.hasLongUpperShadow && a.lowerShadow < a.bodySize * 0.5 && a.bodySize > 0) {
            return { pattern: 'inverted_hammer', strength: this.patternStrength.inverted_hammer };
        }

        return { pattern: null, strength: 0 };
    }

    /**
     * Shooting Star / Hanging Man
     * - Opposite of Hammer
     */
    detectShootingStar(data, idx = -1) {
        const candle = this.getCandle(data, idx);
        if (!candle) return { pattern: null, strength: 0 };

        const a = this.analyzeCandle(candle);
        
        // Shooting Star: long upper shadow, small lower shadow (bearish)
        if (a.hasLongUpperShadow && a.lowerShadow < a.bodySize * 0.5 && a.bodySize > 0) {
            return { pattern: 'shooting_star', strength: this.patternStrength.shooting_star };
        }
        
        // Hanging Man: long lower shadow (bearish signal after uptrend)
        if (a.hasLongLowerShadow && a.upperShadow < a.bodySize * 0.5 && a.bodySize > 0) {
            return { pattern: 'hanging_man', strength: this.patternStrength.hanging_man };
        }

        return { pattern: null, strength: 0 };
    }

    /**
     * Doji / Spinning Top
     * - Very small body relative to total range
     */
    detectDoji(data, idx = -1) {
        const candle = this.getCandle(data, idx);
        if (!candle) return { pattern: null, strength: 0 };

        const a = this.analyzeCandle(candle);
        
        if (a.isDoji) {
            // Determine type based on shadow position
            if (a.upperShadow > a.lowerShadow * 2) {
                return { pattern: 'doji', strength: this.patternStrength.doji };
            }
            return { pattern: 'spinning_top', strength: this.patternStrength.spinning_top };
        }

        return { pattern: null, strength: 0 };
    }

    // ==================== Two Candle Patterns ====================

    /**
     * Bullish Engulfing / Bearish Engulfing
     * - Second candle's body completely engulfs first candle's body
     */
    detectEngulfing(data, idx = -1) {
        if (data.length < 2) return { pattern: null, strength: 0 };

        const candle1 = data[idx - 1];
        const candle2 = data[idx];
        
        if (!candle1 || !candle2) return { pattern: null, strength: 0 };

        const a1 = this.analyzeCandle(candle1);
        const a2 = this.analyzeCandle(candle2);

        // Bullish Engulfing: Bearish first, Bullish second, body engulfs
        if (a1.isBearish && a2.isBullish) {
            if (candle2.open < candle1.close && candle2.close > candle1.open) {
                return { pattern: 'bullish_engulfing', strength: this.patternStrength.bullish_engulfing };
            }
        }

        // Bearish Engulfing: Bullish first, Bearish second, body engulfs
        if (a1.isBullish && a2.isBearish) {
            if (candle2.open > candle1.close && candle2.close < candle1.open) {
                return { pattern: 'bearish_engulfing', strength: this.patternStrength.bearish_engulfing };
            }
        }

        return { pattern: null, strength: 0 };
    }

    /**
     * Piercing Line / Dark Cloud Cover
     * - Two candle patterns with specific open/close positions
     */
    detectPiercingDarkCloud(data, idx = -1) {
        if (data.length < 2) return { pattern: null, strength: 0 };

        const candle1 = data[idx - 1];
        const candle2 = data[idx];
        
        if (!candle1 || !candle2) return { pattern: null, strength: 0 };

        const a1 = this.analyzeCandle(candle1);
        const a2 = this.analyzeCandle(candle2);

        // Piercing Line: Bearish first, Bullish second, opens below, closes above midpoint
        if (a1.isBearish && a2.isBullish) {
            if (candle2.open < candle1.low && candle2.close > (candle1.open + candle1.close) / 2) {
                return { pattern: 'piercing_line', strength: this.patternStrength.piercing_line };
            }
        }

        // Dark Cloud Cover: Bullish first, Bearish second, opens above, closes below midpoint
        if (a1.isBullish && a2.isBearish) {
            if (candle2.open > candle1.high && candle2.close < (candle1.open + candle1.close) / 2) {
                return { pattern: 'dark_cloud_cover', strength: this.patternStrength.dark_cloud_cover };
            }
        }

        return { pattern: null, strength: 0 };
    }

    /**
     * Harami / Harami Cross
     * - Second candle's body is contained within first candle's body
     */
    detectHarami(data, idx = -1) {
        if (data.length < 2) return { pattern: null, strength: 0 };

        const candle1 = data[idx - 1];
        const candle2 = data[idx];
        
        if (!candle1 || !candle2) return { pattern: null, strength: 0 };

        const a1 = this.analyzeCandle(candle1);
        const a2 = this.analyzeCandle(candle2);

        // First candle should have larger body
        if (a1.bodySize <= a2.bodySize) return { pattern: null, strength: 0 };

        // Check if second candle is within first candle's range
        const withinRange = (
            candle2.high < candle1.high &&
            candle2.low > candle1.low
        );

        if (!withinRange) return { pattern: null, strength: 0 };

        // Bullish Harami: First is bearish, second is bullish
        if (a1.isBearish && a2.isBullish) {
            return { pattern: 'bullish_harami', strength: this.patternStrength.bullish_harami };
        }

        // Bearish Harami: First is bullish, second is bearish
        if (a1.isBullish && a2.isBearish) {
            return { pattern: 'bearish_harami', strength: this.patternStrength.bearish_harami };
        }

        return { pattern: null, strength: 0 };
    }

    // ==================== Three Candle Patterns ====================

    /**
     * Morning Star / Evening Star
     * - Three candle reversal pattern
     */
    detectStarPattern(data, idx = -1) {
        if (data.length < 3) return { pattern: null, strength: 0 };

        const candle1 = data[idx - 2];
        const candle2 = data[idx - 1];
        const candle3 = data[idx];
        
        if (!candle1 || !candle2 || !candle3) return { pattern: null, strength: 0 };

        const a1 = this.analyzeCandle(candle1);
        const a2 = this.analyzeCandle(candle2);
        const a3 = this.analyzeCandle(candle3);

        // Morning Star: Bearish -> Small -> Bullish
        if (a1.isBearish && a2.bodySize < a1.bodySize * 0.3 && a3.isBullish) {
            // Third candle should close well into first candle
            if (candle3.close > (candle1.open + candle1.close) / 2) {
                return { pattern: 'morning_star', strength: this.patternStrength.morning_star };
            }
        }

        // Evening Star: Bullish -> Small -> Bearish
        if (a1.isBullish && a2.bodySize < a1.bodySize * 0.3 && a3.isBearish) {
            if (candle3.close < (candle1.open + candle1.close) / 2) {
                return { pattern: 'evening_star', strength: this.patternStrength.evening_star };
            }
        }

        return { pattern: null, strength: 0 };
    }

    /**
     * Three White Soldiers / Three Black Crows
     * - Three consecutive strong candles
     */
    detectThreeSoldiersCrows(data, idx = -1) {
        if (data.length < 3) return { pattern: null, strength: 0 };

        const candle1 = data[idx - 2];
        const candle2 = data[idx - 1];
        const candle3 = data[idx];
        
        if (!candle1 || !candle2 || !candle3) return { pattern: null, strength: 0 };

        const a1 = this.analyzeCandle(candle1);
        const a2 = this.analyzeCandle(candle2);
        const a3 = this.analyzeCandle(candle3);

        // Three White Soldiers: Three bullish candles, each closing higher
        if (a1.isBullish && a2.isBullish && a3.isBullish) {
            if (candle2.close > candle1.close && candle3.close > candle2.close) {
                // Lower shadows should be small
                if (a1.lowerShadow < a1.bodySize * 0.3 && 
                    a2.lowerShadow < a2.bodySize * 0.3 && 
                    a3.lowerShadow < a3.bodySize * 0.3) {
                    return { pattern: 'three_white_soldiers', strength: this.patternStrength.three_white_soldiers };
                }
            }
        }

        // Three Black Crows: Three bearish candles, each closing lower
        if (a1.isBearish && a2.isBearish && a3.isBearish) {
            if (candle2.close < candle1.close && candle3.close < candle2.close) {
                if (a1.upperShadow < a1.bodySize * 0.3 && 
                    a2.upperShadow < a2.bodySize * 0.3 && 
                    a3.upperShadow < a3.bodySize * 0.3) {
                    return { pattern: 'three_black_crows', strength: this.patternStrength.three_black_crows };
                }
            }
        }

        return { pattern: null, strength: 0 };
    }

    // ==================== Reversal Patterns (Multi-Swing) ====================

    /**
     * Find local pivot highs and lows
     * @param {Array} data - OHLCV data
     * @param {number} lookback - Number of bars to check for pivot
     * @returns {Object} - {highs: [{idx, price}], lows: [{idx, price}]}
     */
    findPivots(data, lookback = 5) {
        const highs = [];
        const lows = [];

        for (let i = lookback; i < data.length - lookback; i++) {
            const current = data[i];
            let isHigh = true;
            let isLow = true;

            // Check if current is a local high/low
            for (let j = 1; j <= lookback; j++) {
                if (data[i - j].high >= current.high || data[i + j].high >= current.high) {
                    isHigh = false;
                }
                if (data[i - j].low <= current.low || data[i + j].low <= current.low) {
                    isLow = false;
                }
            }

            if (isHigh) highs.push({ idx: i, price: current.high, date: current.date });
            if (isLow) lows.push({ idx: i, price: current.low, date: current.date });
        }

        return { highs, lows };
    }

    /**
     * Detect Double Top pattern
     * - Two peaks at similar levels with a trough in between
     * - Bearish reversal signal
     */
    detectDoubleTop(data) {
        if (data.length < 20) return { pattern: null, strength: 0 };

        // Use smaller lookback to find more pivots
        const { highs, lows } = this.findPivots(data, 2);
        
        if (highs.length < 2) return { pattern: null, strength: 0 };

        // Look for two peaks - check last 60% of data
        const recentStart = Math.floor(data.length * 0.4);
        const recentHighs = highs.filter(h => h.idx >= recentStart);

        if (recentHighs.length < 2) {
            // If not enough in recent window, check ALL highs for last 2
            const lastTwo = highs.slice(-2);
            if (lastTwo.length < 2) return { pattern: null, strength: 0 };
            
            const peak1 = lastTwo[0];
            const peak2 = lastTwo[1];
            
            // Check if peaks are at similar levels (within 3%)
            const priceDiff = Math.abs(peak1.price - peak2.price) / peak1.price;
            
            if (priceDiff < 0.03) {
                // Check there's a trough between them
                const troughs = lows.filter(l => l.idx > peak1.idx && l.idx < peak2.idx);
                if (troughs.length > 0) {
                    return { 
                        pattern: 'double_top', 
                        strength: this.patternStrength.double_top,
                        points: [peak1, troughs[0], peak2]
                    };
                }
            }
            return { pattern: null, strength: 0 };
        }

        // Get last two highs in recent window
        const peak1 = recentHighs[recentHighs.length - 2];
        const peak2 = recentHighs[recentHighs.length - 1];

        // Check if peaks are at similar levels (within 3%)
        const priceDiff = Math.abs(peak1.price - peak2.price) / peak1.price;
        
        if (priceDiff < 0.03) {
            // Check there's a trough between them
            const troughs = lows.filter(l => l.idx > peak1.idx && l.idx < peak2.idx);
            if (troughs.length > 0) {
                return { 
                    pattern: 'double_top', 
                    strength: this.patternStrength.double_top,
                    points: [peak1, troughs[0], peak2]
                };
            }
        }

        return { pattern: null, strength: 0 };
    }

    /**
     * Detect Double Bottom pattern
     * - Two troughs at similar levels with a peak in between
     * - Bullish reversal signal
     */
    detectDoubleBottom(data) {
        if (data.length < 20) return { pattern: null, strength: 0 };

        const { highs, lows } = this.findPivots(data, 2);
        
        if (lows.length < 2) return { pattern: null, strength: 0 };

        // Look for two troughs - check last 60% of data
        const recentStart = Math.floor(data.length * 0.4);
        const recentLows = lows.filter(l => l.idx >= recentStart);

        if (recentLows.length < 2) {
            // If not enough in recent window, check ALL lows for last 2
            const lastTwo = lows.slice(-2);
            if (lastTwo.length < 2) return { pattern: null, strength: 0 };
            
            const trough1 = lastTwo[0];
            const trough2 = lastTwo[1];
            
            // Check if troughs are at similar levels (within 3%)
            const priceDiff = Math.abs(trough1.price - trough2.price) / trough1.price;
            
            if (priceDiff < 0.03) {
                // Check there's a peak between them
                const peaks = highs.filter(h => h.idx > trough1.idx && h.idx < trough2.idx);
                if (peaks.length > 0) {
                    return { 
                        pattern: 'double_bottom', 
                        strength: this.patternStrength.double_bottom,
                        points: [trough1, peaks[0], trough2]
                    };
                }
            }
            return { pattern: null, strength: 0 };
        }

        // Get last two lows in recent window
        const trough1 = recentLows[recentLows.length - 2];
        const trough2 = recentLows[recentLows.length - 1];

        // Check if troughs are at similar levels (within 3%)
        const priceDiff = Math.abs(trough1.price - trough2.price) / trough1.price;
        
        if (priceDiff < 0.03) {
            // Check there's a peak between them
            const peaks = highs.filter(h => h.idx > trough1.idx && h.idx < trough2.idx);
            if (peaks.length > 0) {
                return { 
                    pattern: 'double_bottom', 
                    strength: this.patternStrength.double_bottom,
                    points: [trough1, peaks[0], trough2]
                };
            }
        }

        return { pattern: null, strength: 0 };
    }

    /**
     * Detect Head and Shoulders pattern
     * - Left shoulder, head (higher), right shoulder (lower or equal)
     * - Bearish reversal signal
     */
    detectHeadAndShoulders(data) {
        if (data.length < 25) return { pattern: null, strength: 0 };

        const { highs, lows } = this.findPivots(data, 2);
        
        if (highs.length < 3) return { pattern: null, strength: 0 };

        // Look for H&S - check last 60% or use last 3 highs
        const recentStart = Math.floor(data.length * 0.4);
        let recentHighs = highs.filter(h => h.idx >= recentStart);

        if (recentHighs.length < 3) {
            recentHighs = highs.slice(-3);
            if (recentHighs.length < 3) return { pattern: null, strength: 0 };
        }

        // Get last three highs: left shoulder, head, right shoulder
        const lastThree = recentHighs.slice(-3);
        const leftShoulder = lastThree[0];
        const head = lastThree[1];
        const rightShoulder = lastThree[2];

        // Head should be higher than both shoulders
        if (head.price > leftShoulder.price && head.price > rightShoulder.price) {
            // Shoulders should be at similar levels (within 5%)
            const shoulderDiff = Math.abs(leftShoulder.price - rightShoulder.price) / leftShoulder.price;
            
            if (shoulderDiff < 0.05) {
                return { 
                    pattern: 'head_and_shoulders', 
                    strength: this.patternStrength.head_and_shoulders,
                    points: [leftShoulder, head, rightShoulder]
                };
            }
        }

        return { pattern: null, strength: 0 };
    }

    /**
     * Detect Inverse Head and Shoulders pattern
     * - Left shoulder, head (lower), right shoulder (higher or equal)
     * - Bullish reversal signal
     */
    detectInverseHeadAndShoulders(data) {
        if (data.length < 25) return { pattern: null, strength: 0 };

        const { highs, lows } = this.findPivots(data, 2);
        
        if (lows.length < 3) return { pattern: null, strength: 0 };

        // Look for inverse H&S - check last 60% or use last 3 lows
        const recentStart = Math.floor(data.length * 0.4);
        let recentLows = lows.filter(l => l.idx >= recentStart);

        if (recentLows.length < 3) {
            recentLows = lows.slice(-3);
            if (recentLows.length < 3) return { pattern: null, strength: 0 };
        }

        // Get last three lows: left shoulder, head, right shoulder
        const lastThree = recentLows.slice(-3);
        const leftShoulder = lastThree[0];
        const head = lastThree[1];
        const rightShoulder = lastThree[2];

        // Head should be lower than both shoulders
        if (head.price < leftShoulder.price && head.price < rightShoulder.price) {
            // Shoulders should be at similar levels (within 5%)
            const shoulderDiff = Math.abs(leftShoulder.price - rightShoulder.price) / leftShoulder.price;
            
            if (shoulderDiff < 0.05) {
                return { 
                    pattern: 'inverse_head_and_shoulders', 
                    strength: this.patternStrength.inverse_head_and_shoulders,
                    points: [leftShoulder, head, rightShoulder]
                };
            }
        }

        return { pattern: null, strength: 0 };
    }

    // ==================== Continuation Patterns ====================

    /**
     * Detect Rising Wedge pattern
     * - Both upper and lower trendlines slope upward, but price compresses
     * - Typically bearish (continuation or reversal)
     */
    detectRisingWedge(data) {
        if (data.length < 15) return { pattern: null, strength: 0 };

        // Get recent data (last 50%)
        const startIdx = Math.floor(data.length * 0.5);
        const recentData = data.slice(startIdx);
        
        if (recentData.length < 8) return { pattern: null, strength: 0 };

        // Fit trendlines to highs and lows
        const highs = recentData.map(d => d.high);
        const lows = recentData.map(d => d.low);
        
        const highSlope = this.calculateSlope(highs);
        const lowSlope = this.calculateSlope(lows);

        // Both slopes should be positive (upward)
        if (highSlope > 0 && lowSlope > 0) {
            // Check compression - low slope should be higher than high slope (converging)
            if (lowSlope > highSlope * 1.1) {
                return { 
                    pattern: 'rising_wedge', 
                    strength: this.patternStrength.rising_wedge
                };
            }
        }

        return { pattern: null, strength: 0 };
    }

    /**
     * Detect Falling Wedge pattern
     * - Both upper and lower trendlines slope downward, but price compresses
     * - Typically bullish (continuation or reversal)
     */
    detectFallingWedge(data) {
        if (data.length < 15) return { pattern: null, strength: 0 };

        // Get recent data (last 50%)
        const startIdx = Math.floor(data.length * 0.5);
        const recentData = data.slice(startIdx);
        
        if (recentData.length < 8) return { pattern: null, strength: 0 };

        // Fit trendlines to highs and lows
        const highs = recentData.map(d => d.high);
        const lows = recentData.map(d => d.low);
        
        const highSlope = this.calculateSlope(highs);
        const lowSlope = this.calculateSlope(lows);

        // Both slopes should be negative (downward)
        if (highSlope < 0 && lowSlope < 0) {
            // Check compression - high slope should be more negative than low slope (converging)
            // i.e., high falls faster than low, wedge narrows
            if (highSlope < lowSlope * 1.1) {
                return { 
                    pattern: 'falling_wedge', 
                    strength: this.patternStrength.falling_wedge
                };
            }
        }

        return { pattern: null, strength: 0 };
    }

    /**
     * Calculate linear regression slope
     */
    calculateSlope(values) {
        const n = values.length;
        if (n < 2) return 0;

        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        
        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += values[i];
            sumXY += i * values[i];
            sumX2 += i * i;
        }

        const denominator = n * sumX2 - sumX * sumX;
        if (denominator === 0) return 0;

        return (n * sumXY - sumX * sumY) / denominator;
    }

    /**
     * Detect Bull Flag pattern
     * - Sharp upward move (pole) followed by consolidation (flag)
     * - Bullish continuation
     */
    detectBullFlag(data) {
        if (data.length < 15) return { pattern: null, strength: 0 };

        // Look for strong upward move followed by consolidation
        const { highs, lows } = this.findPivots(data, 2);
        
        if (highs.length < 2) return { pattern: null, strength: 0 };

        // Get last significant high and low
        const recentHighs = highs.slice(-2);
        const recentLows = lows.slice(-2);

        if (recentHighs.length < 2 || recentLows.length < 2) return { pattern: null, strength: 0 };

        const poleStart = recentLows[0].price;
        const poleEnd = recentHighs[recentHighs.length - 1].price;
        const poleHeight = (poleEnd - poleStart) / poleStart;

        // Pole should be at least 8% upward move
        if (poleHeight < 0.08) return { pattern: null, strength: 0 };

        // Check if price is consolidating after the pole
        const flagStartIdx = recentHighs[recentHighs.length - 1].idx;
        const recentData = data.slice(flagStartIdx);
        
        if (recentData.length < 4) return { pattern: null, strength: 0 };

        // Flag should have declining volatility
        const flagRange = recentData.map(d => d.high - d.low);
        const avgRange = flagRange.reduce((a, b) => a + b, 0) / flagRange.length;
        const poleRange = (poleEnd - poleStart) / 10; // Approximate

        if (avgRange < poleRange * 0.6) {
            return { 
                pattern: 'bull_flag', 
                strength: this.patternStrength.bull_flag
            };
        }

        return { pattern: null, strength: 0 };
    }

    /**
     * Detect Bear Flag pattern
     * - Sharp downward move (pole) followed by consolidation (flag)
     * - Bearish continuation
     */
    detectBearFlag(data) {
        if (data.length < 15) return { pattern: null, strength: 0 };

        const { highs, lows } = this.findPivots(data, 2);
        
        if (highs.length < 2 || lows.length < 2) return { pattern: null, strength: 0 };

        const recentHighs = highs.slice(-2);
        const recentLows = lows.slice(-2);

        const poleStart = recentHighs[0].price;
        const poleEnd = recentLows[recentLows.length - 1].price;
        const poleDrop = (poleStart - poleEnd) / poleStart;

        // Pole should be at least 8% downward move
        if (poleDrop < 0.08) return { pattern: null, strength: 0 };

        // Check consolidation after the pole
        const flagStartIdx = recentLows[recentLows.length - 1].idx;
        const recentData = data.slice(flagStartIdx);
        
        if (recentData.length < 4) return { pattern: null, strength: 0 };

        const flagRange = recentData.map(d => d.high - d.low);
        const avgRange = flagRange.reduce((a, b) => a + b, 0) / flagRange.length;
        const poleRange = (poleStart - poleEnd) / 10;

        if (avgRange < poleRange * 0.6) {
            return { 
                pattern: 'bear_flag', 
                strength: this.patternStrength.bear_flag
            };
        }

        return { pattern: null, strength: 0 };
    }

    /**
     * Detect Triangle patterns (Ascending, Descending, Symmetrical)
     */
    detectTriangles(data) {
        if (data.length < 15) return { pattern: null, strength: 0 };

        const startIdx = Math.floor(data.length * 0.5);
        const recentData = data.slice(startIdx);
        
        if (recentData.length < 8) return { pattern: null, strength: 0 };

        const highs = recentData.map(d => d.high);
        const lows = recentData.map(d => d.low);
        
        const highSlope = this.calculateSlope(highs);
        const lowSlope = this.calculateSlope(lows);

        // Ascending Triangle: flat/high resistance, rising support
        if (Math.abs(highSlope) < 0.3 && lowSlope > 0.5) {
            return { 
                pattern: 'ascending_triangle', 
                strength: this.patternStrength.ascending_triangle
            };
        }

        // Descending Triangle: falling resistance, flat/low support
        if (highSlope < -0.5 && Math.abs(lowSlope) < 0.3) {
            return { 
                pattern: 'descending_triangle', 
                strength: this.patternStrength.descending_triangle
            };
        }

        // Symmetrical Triangle: converging trendlines
        if (highSlope < -0.3 && lowSlope > 0.3) {
            // Check if they're converging
            const earlyHighs = highs.slice(0, Math.floor(highs.length / 2));
            const lateHighs = highs.slice(Math.floor(highs.length / 2));
            const earlyLows = lows.slice(0, Math.floor(lows.length / 2));
            const lateLows = lows.slice(Math.floor(lows.length / 2));

            const earlyRange = Math.max(...earlyHighs) - Math.min(...earlyLows);
            const lateRange = Math.max(...lateHighs) - Math.min(...lateLows);

            if (lateRange < earlyRange * 0.8) {
                return { 
                    pattern: 'symmetrical_triangle', 
                    strength: this.patternStrength.symmetrical_triangle
                };
            }
        }

        return { pattern: null, strength: 0 };
    }

    // ==================== Main Analysis Method ====================

    /**
     * Run all pattern detection on the data
     * @param {Array} data - Array of {date, open, high, low, close, volume}
     * @returns {Object} - {predictions, detectedPatterns}
     */
    async runAnalysis(data) {
        const predictions = {};
        const detectedPatterns = {};

        if (!data || data.length < 3) {
            return { predictions, detectedPatterns };
        }

        // Check last few candles for patterns
        const lookback = Math.min(5, data.length - 1);

        for (let i = data.length - lookback; i < data.length; i++) {
            // Single candle patterns
            const hammer = this.detectHammer(data, i);
            if (hammer.pattern) {
                predictions[hammer.pattern] = hammer.strength;
                detectedPatterns[hammer.pattern] = { idx: i, strength: hammer.strength };
            }

            const shooting = this.detectShootingStar(data, i);
            if (shooting.pattern) {
                predictions[shooting.pattern] = shooting.strength;
                detectedPatterns[shooting.pattern] = { idx: i, strength: shooting.strength };
            }

            const doji = this.detectDoji(data, i);
            if (doji.pattern) {
                predictions[doji.pattern] = doji.strength;
                detectedPatterns[doji.pattern] = { idx: i, strength: doji.strength };
            }

            // Two candle patterns
            if (i >= 1) {
                const engulfing = this.detectEngulfing(data, i);
                if (engulfing.pattern) {
                    predictions[engulfing.pattern] = engulfing.strength;
                    detectedPatterns[engulfing.pattern] = { idx: i, strength: engulfing.strength };
                }

                const piercing = this.detectPiercingDarkCloud(data, i);
                if (piercing.pattern) {
                    predictions[piercing.pattern] = piercing.strength;
                    detectedPatterns[piercing.pattern] = { idx: i, strength: piercing.strength };
                }

                const harami = this.detectHarami(data, i);
                if (harami.pattern) {
                    predictions[harami.pattern] = harami.strength;
                    detectedPatterns[harami.pattern] = { idx: i, strength: harami.strength };
                }
            }

            // Three candle patterns
            if (i >= 2) {
                const star = this.detectStarPattern(data, i);
                if (star.pattern) {
                    predictions[star.pattern] = star.strength;
                    detectedPatterns[star.pattern] = { idx: i, strength: star.strength };
                }

                const soldiers = this.detectThreeSoldiersCrows(data, i);
                if (soldiers.pattern) {
                    predictions[soldiers.pattern] = soldiers.strength;
                    detectedPatterns[soldiers.pattern] = { idx: i, strength: soldiers.strength };
                }
            }
        }

        // Reversal patterns (run once on full data, not per-candle)
        const doubleTop = this.detectDoubleTop(data);
        if (doubleTop.pattern) {
            predictions[doubleTop.pattern] = doubleTop.strength;
            detectedPatterns[doubleTop.pattern] = doubleTop;
        }

        const doubleBottom = this.detectDoubleBottom(data);
        if (doubleBottom.pattern) {
            predictions[doubleBottom.pattern] = doubleBottom.strength;
            detectedPatterns[doubleBottom.pattern] = doubleBottom;
        }

        const headAndShoulders = this.detectHeadAndShoulders(data);
        if (headAndShoulders.pattern) {
            predictions[headAndShoulders.pattern] = headAndShoulders.strength;
            detectedPatterns[headAndShoulders.pattern] = headAndShoulders;
        }

        const invHeadAndShoulders = this.detectInverseHeadAndShoulders(data);
        if (invHeadAndShoulders.pattern) {
            predictions[invHeadAndShoulders.pattern] = invHeadAndShoulders.strength;
            detectedPatterns[invHeadAndShoulders.pattern] = invHeadAndShoulders;
        }

        // Continuation patterns
        const risingWedge = this.detectRisingWedge(data);
        if (risingWedge.pattern) {
            predictions[risingWedge.pattern] = risingWedge.strength;
            detectedPatterns[risingWedge.pattern] = risingWedge;
        }

        const fallingWedge = this.detectFallingWedge(data);
        if (fallingWedge.pattern) {
            predictions[fallingWedge.pattern] = fallingWedge.strength;
            detectedPatterns[fallingWedge.pattern] = fallingWedge;
        }

        const bullFlag = this.detectBullFlag(data);
        if (bullFlag.pattern) {
            predictions[bullFlag.pattern] = bullFlag.strength;
            detectedPatterns[bullFlag.pattern] = bullFlag;
        }

        const bearFlag = this.detectBearFlag(data);
        if (bearFlag.pattern) {
            predictions[bearFlag.pattern] = bearFlag.strength;
            detectedPatterns[bearFlag.pattern] = bearFlag;
        }

        const triangles = this.detectTriangles(data);
        if (triangles.pattern) {
            predictions[triangles.pattern] = triangles.strength;
            detectedPatterns[triangles.pattern] = triangles;
        }

        return { predictions, detectedPatterns };
    }

    /**
     * Get aggregate prediction from all patterns
     * @param {Object} predictions - Dict of {pattern: strength}
     * @returns {number} - Aggregate prediction %
     */
    aggregatePrediction(predictions) {
        const patterns = Object.entries(predictions);
        
        if (patterns.length === 0) return 0;

        // Weight: stronger patterns have more influence
        let totalWeight = 0;
        let weightedSum = 0;

        for (const [pattern, strength] of patterns) {
            const weight = Math.abs(strength);
            weightedSum += strength * weight;
            totalWeight += weight;
        }

        return totalWeight > 0 ? weightedSum / totalWeight : 0;
    }
}

module.exports = ChartPatternEngine;
