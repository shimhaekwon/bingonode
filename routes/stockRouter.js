// routes/stockRouter.js
const express = require('express');
const router = express.Router();

const stockController = require('@controllers/stockController.js');

// Data management
router.post('/fetch', stockController.fetchData);      // Fetch and save data
router.post('/list', stockController.getStockList);    // Get available stocks
router.post('/data', stockController.getStockData);    // Get OHLCV data

// Prediction
router.post('/predict', stockController.predict);      // Run prediction
router.post('/predictAll', stockController.predictAll); // Predict all stocks

module.exports = router;
