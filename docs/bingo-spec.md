# Bingo Module Specification

## Overview
This document describes the frontend and backend logic for the Bingo (Lotto analyzer) feature accessible via `/bingo/index.html`.

## Frontend Logic (`public/bingo/`)

### Core Files
- `index.html` – Main page layout (header, top split, controls, tables, sets, preview panel).
- `bingoscript.js` – Main application logic:
  - Data fetching from `/api/bingo/getList` (POST) to populate `window.numChosen`.
  - UI rendering functions:
    - `renderDataViewer()` – builds radio‑button table for round selection.
    - `renderAll()` – orchestrates preparation, statistics, scoring, softmax, exposure set generation, and table rendering.
    - Helper utilities: color mapping, gap analysis, strategy selection, scoring, softmax, sampling, pattern filters.
  - Event listeners:
    - Radio button change → updates applied round and triggers `renderAll()`.
    - Cell click → same as radio.
    - Buttons (run, clear log, paste data).
- `data.js` – Bootstraps data: calls `/api/bingo/getList` via `fetchAllBingoAsNumChosen()` and stores result in `window.numChosen`.
- `styles.css` – Styling (DaisyUI/Tailwind base, lotto color chips, highlights, layout).

### Data Flow
1. Page load → `data.js` attempts to fetch history from backend.
2. On success, `window.numChosen` holds array of `[seq, n1..n6, bonus]`.
3. User selects a round via radio (or cell click) → `applyRound` value set.
4. Clicking **Calculate** (`runBtn`) → `renderAll()`:
   - Prepares cleaned data (`prepareDataOnce()`).
   - Computes multi‑window frequency/recency.
   - Builds 11 analysis types (range groups, mod groups, end‑digit, single).
   - Calculates observed counts `O`, expected `E`, standardized residuals `SR`, and weights `α`.
   - Computes base scores `S(n)` from deficit & recency.
   - Applies gap‑based adjustments and strategy boost (hot/neutral/equal).
   - Derives top‑k candidates and softmax probabilities `P(n)`.
   - Generates 5×6 exposure sets respecting pattern filters (sum, runs, same‑end, odd, roll, Top‑K constraints).
   - Renders main table (번호, 빈도수, 적용회차 추출, 예상 후보군, 예상 미노출) and exposure sets.

### Key Algorithms
- **Multi‑window statistics**: weighted average of frequencies over windows `[8,15,30,60,90]`.
- **Gap analysis**: variance of standardized residuals per type to adjust scores.
- **Strategy selection**: evaluates hot/neutral/equal strategies on recent window, picks best hit rate.
- **Pattern filters**: ensure generated sets meet sum, consecutive, same‑end, odd/even, roll‑over, and Top‑K constraints.
- **Softmax temperature** (`τ = 1.0`) converts scores to probabilities.

## Backend Logic

### Routes (`routes/bingoRouter.js`)
- `POST /api/bingo/getList` → `bingoController.getList`
- `POST /api/bingo/getOne` → `bingoController.getOne`
- `POST /api/bingo/getRecent` → `bingoController.getRecent`
- `POST /api/bingo/sync` → `bingoController.postSync`
- `POST /api/bingo/getPredict` → `bingoController.getPredict`

### Controller (`controllers/bingoController.js`)
- Uses **Zod** for request validation (`insertSchema`, `listSchema`, `seqOnlySchema`).
- Delegates to `bingoService` (sync, prediction) and `bingoModel` (DB queries).
- Logging via `@utils/util.js`.
- Endpoints:
  - `getList`: returns `{rows, total, limit, offset}`.
  - `getOne`: returns single row by `seq`.
  - `getRecent`: similar to `getList` but orders newest first.
  - `setUpsert`: inserts or updates a round.
  - `postSync`: triggers external sync (returns 202 Accepted).
  - `getPredict`: computes prediction window, calls `generatePredictions(options)` (service‑level function), returns prediction result with UI hints.

### Service (`services/bingoService.js` – referenced)
- Implements `syncLatest()` (fetches latest draw from external source and stores via model).
- Implements `generatePredictions(options)` – core algorithm mirrored in frontend but can be run server‑side.

### Model (`models/bingoModel.js` – referenced)
- Wraps database operations (likely SQLite via `sqlite3` package):
  - `getList(limit, offset)`
  - `getOne(seq)`
  - `getRecent(limit, offset)`
  - `setUpsert(seq, data)`

## Program Sequence Diagram (Mermaid)

```mermaid
sequenceDiagram
    participant User
    participant Browser as JS (bingoscript.js)
    participant API as Express (bingoRouter)
    participant Controller as bingoController
    participant Service as bingoService
    participant Model as bingoModel
    participant DB as SQLite

    User->>Browser: Load /bingo/index.html
    Browser->>data.js: fetchAllBingoAsNumChosen()
    data.js->>API: POST /api/bingo/getList
    API->>Controller: getList()
    Controller->>Model: getList(limit, offset)
    Model->>DB: SELECT ... LIMIT ? OFFSET ?
    DB-->>Model: rows
    Model-->>Controller: {rows,total}
    Controller-->>API: JSON {rows,total}
    API-->>Browser: JSON
    Browser->>window.numChosen: store data
    Browser->>renderDataViewer(): build radio table

    User->>Browser: Select round (radio/cell)
    Browser->>applyRound: set value
    Browser->>renderAll(): trigger calculation

    Browser->>API: POST /api/bingo/getList (for fresh data if needed)
    API->>Controller->>Model->>DB->>... (same as above)

    Browser->>prepareDataOnce(): clean & sort
    Browser->>computeMultiWindowStats(): freq/recency
    Browser->>buildAllAnalysisTypes(): 11 groups
    Browser->>computeObserved(): O(t,g)
    Browser->>computeTypeStats(): E, SR, α
    Browser->>scoreNumbers(): S(n)
    Browser->>computeTypeGapAnalysis(): gap adjustment
    Browser->>selectOptimalStrategy(): hot/neutral/equal
    Browser->>adjustScoresByGap(): S_adj
    Browser->>applyStrategyBoost(): final S
    Browser->>topKFromScores(): candidate set
    Browser->>softmaxFromScores(): probabilities P(n)
    Browser->>buildExposureSets(): generate 5×6 sets (with filters)
    Browser->>renderAll(): update DOM (table, sets, panels)

    User->>Browser: Click Calculate (runBtn)
    Browser->>API: POST /api/bingo/getPredict {targetRound, historyRounds...}
    API->>Controller: getPredict()
    Controller->>Service: generatePredictions(options)
    Service->>Model: getRecent/getOne as needed
    Model->>DB: SELECT ...
    DB-->>Model: rows
    Model-->>Service: data
    Service-->>Controller: prediction result
    Controller-->>API: JSON {result, uiHints}
    API-->>Browser: JSON
    Browser->>DOM: update prediction UI (if separate view)
```

## Process Flow (Mermaid Flowchart)

```mermaid
flowchart TD
    A[Start: Load /bingo/index.html] -->|Load page| B[Fetch history data via POST /api/bingo/getList]
    B -->|Store data| C[Store data in window.numChosen]
    C -->|Render table| D[Render radio button table for round selection]
    D -->|User selection| E[User selects a round (radio/cell click)]
    E -->|Set value| F[Set applyRound value]
    F -->|Click calculate| G[User clicks Calculate (runBtn)]
    G -->|Prepare data| H[prepareDataOnce(): clean & sort data]
    H -->|Compute stats| I[computeMultiWindowStats(): freq/recency]
    I -->|Build types| J[buildAllAnalysisTypes(): 11 groups]
    J -->|Compute observed| K[computeObserved(): O(t,g)]
    K -->|Compute stats| L[computeTypeStats(): E, SR, α]
    L -->|Score numbers| M[scoreNumbers(): S(n)]
    M -->|Gap analysis| N[computeTypeGapAnalysis(): gap adjustment]
    N -->|Select strategy| O[selectOptimalStrategy(): hot/neutral/equal]
    O -->|Adjust scores| P[adjustScoresByGap(): S_adj]
    P -->|Apply boost| Q[applyStrategyBoost(): final S]
    Q -->|Top-k candidates| R[topKFromScores(): candidate set]
    R -->|Softmax| S[softmaxFromScores(): probabilities P(n)]
    S -->|Generate sets| T[buildExposureSets(): generate 5×6 sets (with filters)]
    T -->|Render UI| U[renderAll(): update DOM (table, sets, panels)]
    U -->|End| V[End: UI updated]
```

## Process Flow (Mermaid Flowchart)

```mermaid
flowchart TD
    A[Start: Load /bingo/index.html] --> B[Fetch history data via POST /api/bingo/getList]
    B --> C[Store data in window.numChosen]
    C --> D[Render radio button table for round selection]
    D --> E[User selects a round (radio/cell click)]
    E --> F[Set applyRound value]
    F --> G[User clicks Calculate (runBtn)]
    G --> H[prepareDataOnce(): clean & sort data]
    H --> I[computeMultiWindowStats(): freq/recency]
    I --> J[buildAllAnalysisTypes(): 11 groups]
    J --> K[computeObserved(): O(t,g)]
    K --> L[computeTypeStats(): E, SR, α]
    L --> M[scoreNumbers(): S(n)]
    M --> N[computeTypeGapAnalysis(): gap adjustment]
    N --> O[selectOptimalStrategy(): hot/neutral/equal]
    O --> P[adjustScoresByGap(): S_adj]
    P --> Q[applyStrategyBoost(): final S]
    Q --> R[topKFromScores(): candidate set]
    R --> S[softmaxFromScores(): probabilities P(n)]
    S --> T[buildExposureSets(): generate 5×6 sets (with filters)]
    T --> U[renderAll(): update DOM (table, sets, panels)]
    U --> V[End: UI updated]
```
