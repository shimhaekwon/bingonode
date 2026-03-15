# 📋 프로젝트 기획 의도 분석 보고서

## 프로젝트 개요

**프로젝트명**: Hope Stock Prediction System  
**유형**: 주가 예측 및 기술적 분석 웹 애플리케이션

---

## 1. 요구사항 (Needs & Requirements)

### 1.1 핵심 기능

| 번호 | 요구사항 | 구현 |
|------|---------|------|
| N1 | 한국 주요 10개종목 주가 데이터 조회 | ✅ |
| N2 | 기술적 지표 기반 주가 예측 | ✅ |
| N3 | 일간/주간/월간 차트 시각화 | ✅ |
| N4 | 전체 종목 예측 (Predict All) | ✅ |
| N5 | 개별 종목 상세 예측 결과 조회 | ✅ |
| N6 | 외부 의존성 없는 순수 Node.js 예측 | ✅ (Python 대비) |

### 1.2 기술 스택 요구사항

| 구분 | Python 버전 | Node.js 버전 |
|------|-------------|--------------|
| 데이터 소스 | Yahoo Finance (Python) | Yahoo Finance (yahoo-finance2) |
| 예측 엔진 | pandas + scikit-learn | 순수 JavaScript |
| 차트 라이브러리 | Lightweight Charts | Chart.js |
| API 레이어 | `/api/stock/*` | `/api/stock2/*` |

---

## 2. 아키텍처 비교

### 2.1 Python 버전 (index.html)

```
┌─────────────────────────────────────────────────────────────┐
│                     index.html                              │
│              (Lightweight Charts)                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   stock-common.js                            │
│         (공통 UI 로직 - stock-common)                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  /api/stock/*                               │
│                    (stockController)                         │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
    ┌──────────────────┐          ┌──────────────────┐
    │   fetcher.py     │          │  predictor.py    │
    │   (Python)       │          │   (Python)       │
    └──────────────────┘          └──────────────────┘
              │                               │
              ▼                               ▼
    ┌──────────────────┐          ┌──────────────────┐
    │ Yahoo Finance   │          │ pandas/sklearn   │
    └──────────────────┘          └──────────────────┘
```

### 2.2 Node.js 버전 (node-index.html)

```
┌─────────────────────────────────────────────────────────────┐
│                  node-index.html                            │
│                   (Chart.js)                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   stock-common.js                            │
│         (공통 UI 로직 - stock-common)                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  /api/stock2/*                              │
│             (nodeStockController)                           │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
    ┌──────────────────┐          ┌──────────────────┐
    │  stockService    │          │   indicators     │
    │    (Service)     │          │    (Engine)      │
    └──────────────────┘          └──────────────────┘
              │                               │
              ▼                               ▼
    ┌──────────────────┐          ┌──────────────────┐
    │  stockFetcher    │          │ trading-signals  │
    │  (yahoo-finance2│          │    (Node.js)     │
    └──────────────────┘          └──────────────────┘
```

---

## 3. 파일 구조 및 역할

### 3.1 프론트엔드

| 파일 | 역할 | 차이점 |
|------|------|--------|
| `index.html` | Python 예측 버전 메인 페이지 | Lightweight Charts, `/api/stock` |
| `node-index.html` | Node.js 예측 버전 메인 페이지 | Chart.js, `/api/stock2` |
| `js/stock-common.js` | 공통 UI 로직 | 양쪽에서 공유 |
| `js/stock-chart.js` | 차트 초기화 로직 | 차트 라이브러리별 구현 |

### 3.2 백엔드

| 파일 | 역할 | 사용처 |
|------|------|--------|
| `stockController.js` | Python 연동 컨트롤러 | `/api/stock/*` |
| `nodeStockController.js` | Node.js 예측 컨트롤러 | `/api/stock2/*` |
| `stockService.js` | 예측 서비스 로직 | Node.js 버전 |
| `stockFetcher.js` | Yahoo Finance 데이터 조회 | Node.js 버전 |
| `indicators.js` | 기술적 지표 계산 | Node.js 버전 |

---

## 4. 기획 의도

### 4.1 이중 구조의 이유

| 목적 | 설명 |
|------|------|
| **Python 버전 (index.html)** | 검증된 ML 라이브러리 활용, 정밀한 예측 |
| **Node.js 버전 (node-index.html)** | 외부 의존성 제거, 빠른 응답, 플랫폼 독립성 |

### 4.2 핵심 의사결정

1. **Prediction Algorithm 동일화**
   - Python: pandas + scikit-learn
   - Node.js: trading-signals 라이브러리 + 커스텀 알고리즘
   - **의도**: 동일한 결과물 도출을 위한 병렬 개발

2. **UI 재사용**
   - `stock-common.js`: 양쪽 버전에서 공통 사용
   - **의도**: 개발 효율성, 일관된 UX

3. **Chart Library 선택**
   - Python: Lightweight Charts (TradingView)
   - Node.js: Chart.js
   - **의도**: 각 환경에 최적화된 시각화

---

## 5. 대상 종목

### 5.1 한국株 (KRX)

| Ticker | 기업명 |
|--------|--------|
| 005930.KS | Samsung Electronics |
| 000660.KS | SK Hynix |
| 035420.KS | NAVER |
| 051910.KS | LG Energy Solution |
| 006400.KS | Samsung SDI |
| 005490.KS | POSCO Holdings |
| 035720.KS | Kakao |
| 012330.KS | Hyundai Mobis |
| 000270.KS | Kia |
| 068270.KS | Celltrion |

---

## 6. 기능 상세

### 6.1 예측 결과 항목

| 필드 | 설명 |
|------|------|
| `ticker` | 종목 코드 |
| `name` | 기업명 |
| `last_date` | 최종 데이터 날짜 |
| `actual_change` | 실제 변동률 (%) |
| `best_technique` | 최고 성능 기법 |
| `best_similarity` | 최고 유사도 점수 |
| `next_day_prediction` | 다음 날 예측 변동률 (%) |
| `direction` | 예측 방향 (UP/DOWN/FLAT) |

### 6.2 기술적 지표 (Node.js Version)

- Moving Average (MA)
- RSI (Relative Strength Index)
- MACD
- Bollinger Bands
- Stochastic Oscillator

---

## 7. 결론

### 7.1 프로젝트 목표

```
┌────────────────────────────────────────────────────────────┐
│                    Hope Stock Project                      │
├────────────────────────────────────────────────────────────┤
│  1. 한국 대표 10개종목 실시간 주가 데이터 수집            │
│  2. 기술적 분석 기반 단기 예측 알고리즘 개발                │
│  3. Python vs Node.js 예측 결과 비교 검증                  │
│  4. 직관적인 Web UI 제공 (차트, 테이블, 상세 모달)        │
└────────────────────────────────────────────────────────────┘
```

### 7.2 향후 확장 가능성

- [ ] 실시간 웹소켓 연동
- [ ] PostgreSQL로의 DB 마이그레이션
- [ ] Docker 컨테이너화
- [ ] CI/CD 파이프라인 구축
- [ ] ML 모델 고도화 (딥러닝 도입)

---

**문서 작성일**: 2026-03-15
