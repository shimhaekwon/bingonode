// controllers/stockController.js
// DEPRECATED: Python-based stock controller. Replaced by nodeStockController (Node.js).
// Keeping for reference — requires Python scripts/fetcher.py & predictor.py + SQLite DB.
/*
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { spawn } = require('child_process');
const logger = require('../utils/logger.js');

// Helper function to get timestamp with microseconds
function getTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    const millisecond = String(now.getMilliseconds()).padStart(3, '0');
    const [_, nanoseconds] = process.hrtime();
    const microsecond = String(Math.floor(nanoseconds / 1000) % 1000).padStart(3, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}.${millisecond}.${microsecond}`;
}

// Database path
const DB_PATH = path.join(__dirname, '..', 'data', 'stock.db');

// Python paths from environment
const PYTHON_PATH = process.env.PYTHON_PATH || 'python';
const SCRIPT_PATH = process.env.SCRIPT_PATH || path.join(__dirname, '..', 'scripts');

// Initialize database
function initDB() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                reject(err);
                return;
            }
            
            // Create stock_data table
            db.run(`
                CREATE TABLE IF NOT EXISTS stock_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ticker TEXT NOT NULL,
                    date TEXT NOT NULL,
                    open REAL,
                    high REAL,
                    low REAL,
                    close REAL,
                    volume INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(ticker, date)
                )
            `, (err) => {
                if (err) reject(err);
                else resolve(db);
            });
        });
    });
}

// Get or create database connection
let db = null;
async function getDB() {
    if (!db) {
        db = await initDB();
    }
    return db;
}

// Korean stock list
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

// Check if data exists for a specific date
async function hasDataForDate(ticker, date) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT COUNT(*) as count FROM stock_data WHERE ticker = ? AND date = ?',
            [ticker, date],
            (err, row) => {
                if (err) reject(err);
                else resolve(row.count > 0);
            }
        );
    });
}

// Save stock data to SQLite
async function saveStockData(ticker, data) {
    const db = await getDB();
    
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT OR IGNORE INTO stock_data (ticker, date, open, high, low, close, volume)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        let inserted = 0;
        let skipped = 0;
        
        for (const row of data) {
            const result = stmt.run(
                ticker,
                row.date,
                row.open,
                row.high,
                row.low,
                row.close,
                row.volume
            );
            if (result.changes > 0) inserted++;
            else skipped++;
        }
        
        stmt.finalize();
        resolve({ inserted, skipped, total: data.length });
    });
}

// Fetch data from yfinance and save to SQLite
async function fetchStockData(ticker, periodDays = 400) {
    const scriptPath = path.join(SCRIPT_PATH, 'fetcher.py');
    
    return new Promise((resolve, reject) => {
        const proc = spawn(PYTHON_PATH, [scriptPath, ticker, periodDays.toString()]);
        
        let data = '';
        let error = '';
        
        proc.stdout.on('data', (chunk) => {
            data += chunk;
        });
        
        proc.stderr.on('data', (chunk) => {
            error += chunk;
        });
        
        proc.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(error || 'Python script failed'));
                return;
            }
            
            try {
                const result = JSON.parse(data);
                resolve(result);
            } catch (e) {
                reject(new Error('Failed to parse Python output: ' + data));
            }
        });
    });
}

// Run prediction using Python
async function runPrediction(ticker, trainingDays = 240, threshold = 0.5) {
    const scriptPath = path.join(SCRIPT_PATH, 'predictor.py');
    
    return new Promise((resolve, reject) => {
        const proc = spawn(PYTHON_PATH, [scriptPath, ticker, trainingDays.toString(), threshold.toString()]);
        
        let data = '';
        let error = '';
        
        proc.stdout.on('data', (chunk) => {
            data += chunk;
        });
        
        proc.stderr.on('data', (chunk) => {
            error += chunk;
        });
        
        proc.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(error || 'Prediction failed'));
                return;
            }
            
            try {
                const result = JSON.parse(data);
                resolve(result);
            } catch (e) {
                reject(new Error('Failed to parse prediction result'));
            }
        });
    });
}

// ==================== Controller Methods ====================

// GET /api/stock/list - Get available stocks
exports.getStockList = async (req, res) => {
    const methodName = 'getStockList';
    console.log(`[${getTimestamp()}] [START] ${methodName}`);
    try {
        res.json({
            success: true,
            data: KOREAN_STOCKS
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        console.log(`[${getTimestamp()}] [END] ${methodName}`);
    }
};

// POST /api/stock/fetch - Fetch and save data (skip if exists)
exports.fetchData = async (req, res) => {
    const methodName = 'fetchData';
    console.log(`[${getTimestamp()}] [START] ${methodName}`);
    try {
        const { ticker, force = false } = req.body;
        const today = new Date().toISOString().split('T')[0];
        
        if (!ticker) {
            return res.status(400).json({ success: false, error: 'ticker is required' });
        }
        
        // Check if today's data already exists
        if (!force) {
            const exists = await hasDataForDate(ticker, today);
            if (exists) {
                return res.json({
                    success: true,
                    message: 'Data already exists for today',
                    ticker,
                    date: today,
                    action: 'skipped'
                });
            }
        }
        
        // Fetch data from yfinance
        const data = await fetchStockData(ticker);
        
        // Save to SQLite
        if (data && data.length > 0) {
            const saveResult = await saveStockData(ticker, data);
            
            res.json({
                success: true,
                ticker,
                saved: saveResult.inserted,
                skipped: saveResult.skipped,
                dateRange: {
                    from: data[0]?.date,
                    to: data[data.length - 1]?.date
                }
            });
        } else {
            res.json({
                success: true,
                ticker,
                message: 'No data to save',
                action: 'skipped'
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        console.log(`[${getTimestamp()}] [END] ${methodName}`);
    }
};

// POST /api/stock/data - Get stock data from SQLite
exports.getStockData = async (req, res) => {
    const methodName = 'getStockData';
    console.log(`[${getTimestamp()}] [START] ${methodName}`);
    try {
        const { ticker, days = 365 } = req.body;
        const db = await getDB();
        
        const data = await new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM stock_data 
                 WHERE ticker = ? 
                 ORDER BY date DESC 
                 LIMIT ?`,
                [ticker, days],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
        
        res.json({
            success: true,
            ticker,
            count: data.length,
            data: data.reverse() // Oldest first
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        console.log(`[${getTimestamp()}] [END] ${methodName}`);
    }
};

// POST /api/stock/predict - Run prediction for a stock
exports.predict = async (req, res) => {
    const methodName = 'predict';
    console.log(`[${getTimestamp()}] [START] ${methodName}`);
    try {
        const { ticker, trainingDays = 240, threshold = 0.5 } = req.body;
        
        if (!ticker) {
            return res.status(400).json({ success: false, error: 'ticker is required' });
        }
        
        // First ensure we have data
        const today = new Date().toISOString().split('T')[0];
        const hasData = await hasDataForDate(ticker, today);
        
        if (!hasData) {
            // Fetch fresh data
            await fetchStockData(ticker);
        }
        
        // Run prediction
        const result = await runPrediction(ticker, trainingDays, threshold);
        
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        console.log(`[${getTimestamp()}] [END] ${methodName}`);
    }
};

// POST /api/stock/predictAll - Predict all stocks
exports.predictAll = async (req, res) => {
    const methodName = 'predictAll';
    console.log(`[${getTimestamp()}] [START] ${methodName}`);
    try {
        const { trainingDays = 240, threshold = 0.5 } = req.body;
        
        const results = [];
        
        for (const stock of KOREAN_STOCKS) {
            try {
                const result = await runPrediction(stock.ticker, trainingDays, threshold);
                results.push({
                    ...result,
                    name: stock.name
                });
            } catch (error) {
                results.push({
                    ticker: stock.ticker,
                    name: stock.name,
                    error: error.message,
                    success: false
                });
            }
        }
        
        res.json({
            success: true,
            count: results.length,
            results
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        console.log(`[${getTimestamp()}] [END] ${methodName}`);
    }
};
*/
