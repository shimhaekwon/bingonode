// routes/stockRouter2.js
/**
 * Stock Router 2 - Node.js Implementation
 * - Routes for stock prediction using Node.js (no Python)
 */

const express = require('express');
const router = express.Router();

const nodeStockController = require('@controllers/nodeStockController.js');

// List available stocks
router.post('/list', nodeStockController.getStockList);

// Get stock data for chart
router.post('/data', nodeStockController.getStockData);

// Run prediction for one stock
router.post('/predict', nodeStockController.predict);

// Run prediction for all stocks
router.post('/predictAll', nodeStockController.predictAll);

module.exports = router;
