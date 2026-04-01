# Known Composite Strategies for Stock Price Prediction (Node.js Context)

Below is a list of recent composite/hybrid strategies that combine technical indicators with machine learning models for stock price prediction. These approaches can be implemented or adapted using Node.js libraries (e.g., trading-signals, indicators-js, talib) alongside ML libraries like TensorFlow.js, Brain.js, or by calling Python services.

---

## 1. Advancing Stock Price Prediction Through Hybrid Ensembles
- **Source**: Journal of Big Data (Springer Nature)
- **Description**: Comprehensive comparative analysis of machine learning approaches for hybrid ensembles in stock prediction. Examines various ensemble methods combining multiple ML models.
- **URL**: https://journalofbigdata.springeropen.com/articles/10.1186/s40537-025-01185-8

## 2. A Hybrid Model for Stock Price Forecasting Integrating XGBoost and LSTM with Financial Indicators
- **Source**: Research Square
- **Description**: Proposes combining XGBoost with LSTM using financial/technical indicators for improved forecasting accuracy.
- **URL**: https://www.researchsquare.com/article/rs-7396543/v1.pdf

## 3. LSTM Based Stock Price Forecasting Using RSI and MACD
- **Source**: Journal of Embedded System Security and Intelligent Systems
- **Description**: Directly combines RSI and MACD technical indicators with LSTM for stock price forecasting.
- **URL**: https://journal.unm.ac.id/index.php/JESSI/article/download/8518/5293

## 4. A Hybrid CNN-LSTM Attention-Based Deep Learning Model for Stock Price Prediction Using Technical Indicators
- **Source**: Engineering, Technology & Applied Science Research
- **Description**: Uses CNN-LSTM with attention mechanism, incorporating multiple technical indicators for enhanced prediction.
- **URL**: https://etasr.com/index.php/ETASR/article/view/12685

## 5. Adaptive Ensemble of ML Regressors and LSTM for Stock Price Prediction
- **Source**: Springer - Computational Intelligence in Pattern Recognition (2025)
- **Description**: Proposes an adaptive ensemble approach combining traditional ML regressors with LSTM networks.
- **URL**: https://link.springer.com/chapter/10.1007/978-981-97-8090-7_21

## 6. Hybrid Machine Learning Models for Long-Term Stock Market Forecasting: Integrating Technical Indicators
- **Source**: Journal of Risk and Financial Management (MDPI)
- **Description**: Focuses on long-term forecasting using hybrid ML models with integrated technical indicators.
- **URL**: https://www.mdpi.com/1911-0074/18/4/201

## 7. Leveraging Hybrid Ensemble Models in Stock Market Prediction: A Data-Driven Approach
- **Source**: AIMS Press - Data Science in Finance and Economics
- **Description**: A data-driven approach to hybrid ensemble models for stock market prediction (2025).
- **URL**: https://www.aimspress.com/aimspress-data/dsfe/2025/3/PDF/DSFE-05-03-015.pdf

## 8. A Predictive Model of the Stock Market Using LSTM with EMA and RSI Indicators
- **Source**: Journal of Intelligent & Fuzzy Systems (ADS)
- **Description**: Combines Exponential Moving Average (EMA) and RSI indicators with LSTM algorithm for market prediction.
- **URL**: https://ui.adsabs.harvard.edu/abs/2024JIEIB.105.1145D/abstract

## 9. Assessing the Impact of Technical Indicators on Machine Learning Models for Stock Price Prediction
- **Source**: arXiv
- **Description**: Analyzes how various technical indicators impact ML model performance in stock price prediction.
- **URL**: https://arxiv.org/html/2412.15448v1

## 10. A Hybrid LSTM-GRU Model for Stock Price Prediction
- **Source**: IEEE Xplore
- **Description**: Combines LSTM and GRU (Gated Recurrent Unit) architectures for stock prediction.
- **URL**: https://ieeexplore.ieee.org/iel8/6287639/10820123/11072109.pdf

---

### How to Apply in Node.js Environment
1. **Technical Indicator Extraction**: Use libraries like `trading-signals`, `indicators-js`, or `talib` to compute RSI, MACD, Bollinger Bands, EMA, etc.
2. **Feature Engineering**: Normalize indicators and create lagged features (e.g., RSI_t-1, RSI_t-2).
3. **Model Integration**:
   - Use **TensorFlow.js** for LSTM/GRU/CNN models directly in Node.js.
   - Use **Brain.js** for simpler neural networks.
   - For XGBoost/Random Forest, consider calling a Python microservice or using JavaScript ports like `treelite4js`.
4. **Ensemble Techniques**: Combine predictions from multiple models via weighted averaging, stacking, or voting.
5. **Backtesting**: Walk-forward validation with performance metrics (Sharpe ratio, max drawdown, hit rate).

These strategies provide a solid foundation for building robust prediction systems that leverage both traditional technical analysis and modern machine learning.