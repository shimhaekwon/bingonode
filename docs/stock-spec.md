# Hope Stock [Node.js] Module Specification

## Overview
This document describes the frontend and backend logic for the Node.js‑based stock prediction feature accessible via `/stock/node-index.html` (Hope Stock [Node.js]).

## Frontend Logic (`public/stock/`)

### Core Files
- `node-index.html` – Main page: header, stock selection, results table, detail modal, loading spinner.
- `js/stock-common.js` – Shared utilities:
  - Korean stock list (`stockList`).
  - API base (`API_BASE = window.API_BASE || '/api/stock2'`).
  - Formatters (`formatPercent`, `getDirectionClass`, `getDirectionText`).
  - Low‑level fetch wrapper (`fetchAPI`).
  - Rendering helpers (`renderStockButtons`, `renderResult`, `renderResults`).
  - Loading toggle (`showLoading`, `hideLoading`).
  - Data fetching (`fetchStockData`, `predictStock`, `predictAll`).
  - Modal & detail view (`showDetail`, `closeDetailModal`).
  - Exported as `window.StockCommon`.
- `js/stock-chart.js` – Chart strategy pattern:
  - Abstract `StockChartStrategy`.
  - Concrete `ChartJsStrategy` (uses Chart.js to render price/volume).
  - Factory `createChart(containerId, type, options)`.
  - Exported `window.createChart`.

### Data Flow
1. Page loads → sets `window.API_BASE = '/api/stock2'` (inline script).
2. Loads `js/stock-common.js` and `js/stock-chart.js`.
3. Inline script runs:
   - Calls `renderStockButtons()` → builds buttons for each stock from `window.StockCommon.stockList`.
4. User interaction:
   - Click a stock button → calls `predictStock(ticker)` (delegate to `window.StockCommon.predictStock`).
   - Click “Predict All” → calls `predictAll()` (delegate to `window.StockCommon.predictAll`).
   - Click a result row → calls `showDetail(ticker)` → opens modal, fetches prediction + chart data, renders detail.
5. Internal flow of `predictStock` / `predictAll`:
   - Calls `showLoading()`.
   - Calls `fetchAPI(`${API_BASE}/predict`, {ticker})` or `/predictAll`.
   - On success: renders result via `renderResult` / `renderResults`; on error: alert.
   - Calls `hideLoading()`.
6. Detail view (`showDetail`):
   - Shows loading.
   - Fetches prediction (`/predict`) and, if needed, OHLCV data (`/data` with days=365).
   - Updates modal title, info/prediction panels, and all‑techniques table.
   - Initializes or updates chart via `window.initChart()` (provided by `stock-chart.js`) and feeds chronological data.
   - On modal close, destroys chart instance.

### Key Points
- No framework (Vue/React); plain DOM manipulation.
- Uses Chart.js for rendering (via strategy pattern).
- All API calls go to `/api/stock2/*` endpoints.
- UI styling via TailwindCSS + DaisyUI (CDN).

## Backend Logic

### Routes (`routes/stockRouter2.js`)
- `POST /api/stock2/list` → `nodeStockController.getStockList`
- `POST /api/stock2/data` → `nodeStockController.getStockData`
- `POST /api/stock2/predict` → `nodeStockController.predict`
- `POST /api/stock2/predictAll` → `nodeStockController.predictAll`

### Controller (`controllers/nodeStockController.js`)
- Thin wrapper: validates required fields, delegates to `StockService`, logs timestamps, returns JSON `{success:true, ...}` or error.
- Endpoints:
  - `getStockList`: returns static Korean stock list.
  - `getStockData`: proxies to `stockService.getStockData(ticker, days)`.
  - `predict`: proxies to `stockService.predict(ticker, trainingDays, threshold)`.
  - `predictAll`: proxies to `stockService.predictAll(trainingDays, threshold)`.

### Service (`services/stockService.js`)
- Coordinates data fetching and technical analysis.
- Dependencies:
  - `StockFetcher` (`@libs/stockFetcher`) – fetches OHLCV from Yahoo Finance.
  - `IndicatorEngine` (`@libs/indicators`) – computes SMA, EMA, RSI, MACD, Bollinger Bands, ATR, Momentum, Volume.
  - `ChartPatternEngine` (`@libs/chartPatterns`) – detects 39 candlestick patterns.
- Core methods:
  - `getStockList()`: returns hard‑coded KOREAN_STOCKS.
  - `getStockData(ticker, days)`: delegates to `fetcher.fetch(ticker, days)`.
  - `calculateActualChange(data, dayOffset=-1)`: % change between close of day and previous day.
  - `calculateSimilarity(predicted, actual)`: similarity score (0–1) based on direction and magnitude.
  - `validate(predictions, actualChange, threshold)`: returns per‑technique similarity and list of passed techniques.
  - `rankTechniques(similarities)`: sorts techniques by similarity descending.
  - `predict(ticker, trainingDays=240, threshold=0.5)`:
    1. Fetch ~400 days OHLCV via `fetcher.fetch`.
    2. Split into training (last `trainingDays` days, excluding most recent) and full data (including most recent).
    3. Compute actual change of most recent day.
    4. Run indicator + pattern analysis on training data → predictions map.
    5. Validate against actual change → similarities, passed techniques.
    6. Rank techniques.
    7. Run analysis on full data → next‑day predictions for passed techniques.
    8. Average those predictions → `next_day_prediction`.
    9. Assemble result object with ticker, name, last_date, last_close, actual_change, all_predictions, all_similarities, passed_techniques, ranked_techniques, best_technique, best_similarity, next_day_prediction, prediction_direction.
   - `predictAll(trainingDays, threshold)`: loops over `KOREAN_STOCKS`, calls `predict` for each, aggregates results.

### Libraries
- **stockFetcher.js**:
  - Uses `yahoo-finance2` package.
  - `fetch(ticker, periodDays)`: calls `yahooFinance.chart(ticker, {period1, period2, interval:'1d'})`.
  - Transforms quotes to `{date,open,high,low,close,volume}` array, filtering null closes.
- **indicators.js**:
  - Implements SMA, EMA, RSI, MACD, Bollinger Bands, ATR via `trading-signals`.
  - Prediction functions for each indicator return a predicted % change (e.g., SMA crossover → ±2.0%, deviation → scaled).
  - `runAnalysis(data)`: computes all indicators and chart patterns, returns `{predictions}`.
- **chartPatterns.js**:
  - Detects 39 patterns (single, two, three candle, reversal, continuation, triangle).
  - Each pattern has a strength weight (positive for bullish, negative for bearish).
  - `runAnalysis(data)`: scans last few candles for short patterns, runs full‑data scan for multi‑swing patterns, returns `{predictions, detectedPatterns}`.
  - `aggregatePrediction(predictions)`: weighted average of pattern strengths.

## Program Sequence Diagram (Mermaid)

```mermaid
sequenceDiagram
    participant User
    participant Browser as JS (node-index.html + stock-common.js + stock-chart.js)
    participant API as Express (stockRouter2)
    participant Controller as nodeStockController
    participant Service as stockService
    participant Fetcher as stockFetcher
    participant Indicator as indicatorEngine
    participant Patterns as chartPatternEngine
    participant Yahoo as YahooFinance (external)

    User->>Browser: Load /stock/node-index.html
    Browser->>API: GET /api/stock2/list (via StockCommon init)
    API->>Controller: getStockList()
    Controller-->>API: JSON {success:true, data:stockList}
    API-->>Browser: JSON
    Browser->>DOM: render stock buttons

    User->>Browser: Click stock button (or Predict All)
    Browser->>StockCommon: predictStock(ticker) / predictAll()
    StockCommon->>Browser: showLoading()
    StockCommon->>API: POST /api/stock2/predict  (or /predictAll)
    API->>Controller: predict() / predictAll()
    Controller->>Service: predict(...) / predictAll()
    
    alt Single stock
        Service->>Fetcher: fetch(ticker, ~400 days)
        Fetcher->>Yahoo: chart(ticker, range)
        Yahoo-->>Fetcher: quotes[]
        Fetcher-->>Service: OHLCV data[]
        Service->>Indicator: runAnalysis(trainData)
        Indicator-->>Service: predictions (indicators)
        Service->>Patterns: runAnalysis(trainData)
        Patterns-->>Service: predictions (chart patterns)
        Service->>Indicator: runAnalysis(fullData)   // for next day
        Indicator-->>Service: nextPredictions
        Service->>compute: actual change, similarity, validation, ranking
        Service-->>Controller: result object
    else PredictAll
        loop each stock in KOREAN_STOCKS
            Service->>Fetcher: fetch(ticker, ~400 days)
            Fetcher->>Yahoo: chart(...)
            Yahoo-->>Fetcher: quotes[]
            Fetcher-->>Service: OHLCV data[]
            Service->>Indicator + Patterns: runAnalysis (training)
            Service->>compute: validation, ranking
            Service->>Indicator + Patterns: runAnalysis (full)
            Service->>compute: next day prediction
            Service-->>Controller: per‑stock result
        end
    end

    Controller-->>API: JSON {success:true, ...result}
    API-->>Browser: JSON
    Browser->>StockCommon: hideLoading()
    Browser->>StockCommon: renderResult / renderResults (update table)
    
    alt User clicked a result row
        Browser->>StockCommon: showDetail(ticker)
        StockCommon->>Browser: showLoading()
        StockCommon->>API: POST /api/stock2/predict {ticker}
        API->>Controller->>Service: predict(ticker)
        Service->>Fetcher: fetch(ticker, 365)
        Fetcher->>Yahoo: chart(ticker, 365d)
        Yahoo-->>Fetcher: data[]
        Fetcher-->>Service: OHLCV
        Service->>Indicator + Patterns: runAnalysis (for chart data if needed)
        Service-->>Controller: prediction + (optional) chart data
        Controller-->>API: JSON
        API-->>Browser: JSON
        Browser->>StockCommon: hideLoading()
        Browser->>StockCommon: update modal info, table
        Browser->>StockCommon: initChart() (from stock-chart.js)
        Browser->>StockCommon: chart.update(chrondata)
        Browser->>StockCommon: open modal
    end

    User->>Browser: Close modal (optional)
    Browser->>StockCommon: closeDetailModal()
    StockCommon->>Browser: destroy chart instance, hide modal
```

## Process Flow (Mermaid Flowchart)

```mermaid
flowchart TD
    A[Start: Load /stock/node-index.html] --> B[Fetch stock list via GET /api/stock2/list]
    B --> C[Render stock buttons]
    C --> D[User clicks stock button or Predict All]
    D --> E[Show loading spinner]
    E --> F[POST /api/stock2/predict (single) or /predictAll]
    F --> G[Controller validates request]
    G --> H[Service fetches OHLCV data via stockFetcher]
    H --> I[Yahoo Finance API (external)]
    I --> J[Return OHLCV data]
    J --> K[Service runs indicator & pattern analysis on training data]
    K --> L[Compute actual change & validate predictions]
    L --> M[Rank techniques & select passed ones]
    M --> N[Run analysis on full data for next-day prediction]
    N --> O[Aggregate final prediction]
    O --> P[Return JSON result]
    P --> Q[Hide loading spinner]
    Q --> R[Render result in table]
    R --> S[User clicks result row for detail]
    S --> T[Show loading spinner]
    T --> U[POST /api/stock2/predict {ticker}]
    U --> V[Controller -> Service -> Fetcher -> Yahoo (365 days)]
    V --> W[Service computes prediction & chart data]
    W --> X[Return JSON]
    X --> Y[Hide loading spinner]
    Y --> Z[Update modal: info, techniques table]
    Z --> AA[Initialize/update Chart.js via stock-chart.js]
    AA --> AB[Render chart with chronological data]
    AB --> AC[Open detail modal]
    AC --> AD[User closes modal]
    AD --> AE[Destroy chart instance, hide modal]
    AE --> AF[End]
```
