// controllers/nodeStockController.js
/**
 * Node.js Stock Prediction Controller
 * - API endpoints for stock prediction using Node.js logic (no Python)
 */

const StockService = require('@services/stockService');

// Helper function to get timestamp
function getTimestamp() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
           `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

// Initialize service
const stockService = new StockService();

// ==================== Controller Methods ====================

// GET /api/stock2/list - Get available stocks
exports.getStockList = async (req, res) => {
    const methodName = 'getStockList';
    console.log(`[${getTimestamp()}] [START] ${methodName}`);
    try {
        const stocks = stockService.getStockList();
        res.json({
            success: true,
            data: stocks
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        console.log(`[${getTimestamp()}] [END] ${methodName}`);
    }
};

// POST /api/stock2/data - Get stock data for chart
exports.getStockData = async (req, res) => {
    const methodName = 'getStockData';
    console.log(`[${getTimestamp()}] [START] ${methodName}`);
    try {
        const { ticker, days = 365 } = req.body;

        if (!ticker) {
            return res.status(400).json({ success: false, error: 'ticker is required' });
        }

        const data = await stockService.getStockData(ticker, days);

        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    } finally {
        console.log(`[${getTimestamp()}] [END] ${methodName}`);
    }
};

// POST /api/stock2/predict - Run prediction for a stock
exports.predict = async (req, res) => {
    const methodName = 'predict';
    console.log(`[${getTimestamp()}] [START] ${methodName}`);
    try {
        const { ticker, trainingDays = 240, threshold = 0.5 } = req.body;

        if (!ticker) {
            return res.status(400).json({ success: false, error: 'ticker is required' });
        }

        const result = await stockService.predict(ticker, trainingDays, threshold);

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

// POST /api/stock2/predictAll - Predict all stocks
exports.predictAll = async (req, res) => {
    const methodName = 'predictAll';
    console.log(`[${getTimestamp()}] [START] ${methodName}`);
    try {
        const { trainingDays = 240, threshold = 0.5 } = req.body;

        const results = await stockService.predictAll(trainingDays, threshold);

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
