# Node.js 라이브러리 – 복합 전략 구축에 활용 가능한 목록

| 라이브러리 | 주요 특징 / 제공 기능 | npm / 저장소 링크 |
|-----------|----------------------|-------------------|
| **trading-signals** | TypeScript/JavaScript 기술 지표 및 오버레이 (RSI, MACD, 볼린저 밴드, SMA, EMA 등). 의존성 없음, 브라우저 & Node.js 모두 지원. | `npm i trading-signals`<br>https://www.npmjs.com/package/trading-signals<br>https://github.com/bennycode/trading-signals |
| **talib** (node-talib) | TA‑Lib C 래퍼. 200+ 지표 (MACD, RSI, 볼린저 밴드, 스토캐스틱, ADX 등) 제공. 고성능 네이티브 구현. | `npm i talib`<br>https://www.npmjs.com/package/talib<br>https://github.com/oransel/node-talib |
| **indicators-js** | 가장 빠른 순수 JavaScript 지표 라이브러리. 100+ 지표 (SMA, EMA, RSI, MACD 등). Node.js, 브라우저, Bun, React, Angular에서 사용 가능. | `npm i indicators-js`<br>https://www.npmjs.com/package/indicators-js<br>https://github.com/ixjb94/indicators-js |
| **indicatorts** | 순수 TypeScript 기술 지표 및 전략 모음. 의존성 없음. 트레이딩 로직을 직접 작성하기에 적합. | `npm i indicatorts`<br>https://www.npmjs.com/package/indicatorts |
| **ta-math** | OHLCV 데이터용 기술 분석 라이브러리. 이동 평균, 오실레이터, 변동성 지표 등 기본 기능 제공. | `npm i ta-math`<br>https://www.npmjs.com/package/ta-math |
| **talib.ts** | TypeScript로 구현된 TA‑Lib 복제본. 원래 TA‑Lib 함수 전체 + 추가 함수 제공. 네이티브 의존성 없음. | `npm i talib.ts`<br>https://www.npmjs.com/package/talib.ts<br>https://github.com/fksolari/talib.ts |
| **fast-technical-indicators** | 고성능, zero‑dependency 라이브러리. `technicalindicators` 와 호환되는 API 제공. 백테스팅 시 속도 중요할 때 유용. | `npm i fast-technical-indicators`<br>https://www.npmjs.com/package/fast-technical-indicators |

### 복합 전략 구축 시 활용 팁
1. **지표 조합** – 예) `trading-signals` 로 RSI·MACD·볼린저 밴드 값을 가져와 가중 점수 모델(Score = w₁·RSI_norm + w₂·MACD_hist + w₃·BB_width) 구현.
2. **고속 백테스트** – `indicators-js` 혹은 `fast-technical-indicators` 로 대량의 시계열 데이터를 빠르게 지표화하고, 머신러닝 모델(XGBoost, LightGBM 등)에 입력 피처로 사용.
3. **모든 지표가 필요할 때** – `talib` (또는 `talib.ts`) 로 200개 이상 지표를 손쉽게 획득 후 피처 선택 또는 앙상블에 활용.
4. **전략 로직 캡슐화** – `indicatorts` 같은 전략‑지향 라이브러리에서 제공하는 사전 정의된 전략(크로스오버, 돌파 등)을 베이스로 삼아 자체 규칙 레이어를 추가.

> 위 라이브러리들은 모두 npm에서 바로 설치 가능하며, TypeScript 지원이 잘 되어 있어 NestJS, Express, 혹은 Next.js 백엔드에서 손쉽게 복합 전략 파이프라인을 구성할 수 있습니다.  

필요한 라이브러리를 골라서 간단한 예시 코드나 전략 구조가 더 필요하면 알려 주세요! 🚀