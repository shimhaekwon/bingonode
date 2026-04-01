/**
 * stock-chart.js
 * Simple Chart Module (Strategy Pattern)
 */

class StockChartStrategy {
    constructor(containerId, height) {
        this.containerId = containerId;
        this.height = height;
        this.chart = null;
    }

    init() { throw new Error('Not implemented'); }
    update(data) { throw new Error('Not implemented'); }
    destroy() { throw new Error('Not implemented'); }
}

// Chart.js Strategy (legacy fallback)
class ChartJsStrategy extends StockChartStrategy {
    init() {
        const container = document.getElementById(this.containerId);
        if (!container) return false;

        const priceHeight = Math.floor(this.height * 0.7);
        const volumeHeight = this.height - priceHeight - 10;

        container.innerHTML = `
            <div style="height: ${priceHeight}px;"><canvas id="${this.containerId}-price"></canvas></div>
            <div style="height: ${volumeHeight}px; margin-top: 10px;"><canvas id="${this.containerId}-volume"></canvas></div>
        `;

        const priceCtx = document.getElementById(`${this.containerId}-price`);
        const volumeCtx = document.getElementById(`${this.containerId}-volume`);

        this.chart = {
            price: new Chart(priceCtx, {
                type: 'bar',
                data: { labels: [], datasets: [] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { position: 'right' } } }
            }),
            volume: new Chart(volumeCtx, {
                type: 'bar',
                data: { labels: [], datasets: [] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { position: 'right' } } }
            })
        };
        return true;
    }

    update(data) {
        if (!this.chart || !data || data.length === 0) return;
        const displayData = data;
        const labels = displayData.map(d => d.date);
        const colors = displayData.map(d => d.close >= d.open ? 'rgba(239, 68, 68, 0.7)' : 'rgba(59, 130, 246, 0.7)');

        this.chart.price.data.labels = labels;
        this.chart.price.data.datasets = [
            { type: 'bar', label: 'High-Low', data: displayData.map(d => d.high - d.low), backgroundColor: colors, borderColor: colors.map(c => c.replace('0.7', '1')), borderWidth: 1 },
            { type: 'line', label: 'Close', data: displayData.map(d => d.close), borderColor: '#333', borderWidth: 2, fill: false, tension: 0.1 }
        ];
        this.chart.price.update();

        this.chart.volume.data.labels = labels;
        this.chart.volume.data.datasets = [{ label: 'Volume', data: displayData.map(d => d.volume), backgroundColor: colors, borderWidth: 0 }];
        this.chart.volume.update();
    }

    destroy() {
        if (this.chart) {
            this.chart.price.destroy();
            this.chart.volume.destroy();
            this.chart = null;
        }
        const container = document.getElementById(this.containerId);
        if (container) container.innerHTML = '';
    }
}

// Lightweight Charts Strategy
// NOTE: Used by the deprecated Python stock page (public/stock/index.html).
// node-index.html uses NaverStyleStrategy. Kept for reference.
class LightweightStrategy extends StockChartStrategy {
    init() {
        if (typeof LightweightCharts === 'undefined') return false;
        const container = document.getElementById(this.containerId);
        if (!container) return false;

        this.chart = LightweightCharts.createChart(container, {
            width: container.offsetWidth || 600,
            height: this.height,
            layout: { backgroundColor: '#ffffff', textColor: '#333' },
            grid: { vertLines: { color: '#f0f0f0' }, horzLines: { color: '#f0f0f0' } },
            rightPriceScale: { borderColor: '#ddd' },
            timeScale: { borderColor: '#ddd', timeVisible: true }
        });

        this.candleSeries = this.chart.addCandlestickSeries({
            upColor: '#ef4444', downColor: '#3b82f6',
            borderUpColor: '#ef4444', borderDownColor: '#3b82f6',
            wickUpColor: '#ef4444', wickDownColor: '#3b82f6'
        });

        this.volumeSeries = this.chart.addHistogramSeries({
            color: '#26a69a', priceFormat: { type: 'volume' }, priceScaleId: 'volume'
        });
        this.volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

        return true;
    }

    update(data) {
        if (!this.chart || !this.candleSeries || !this.volumeSeries || !data || data.length === 0) return;

        const candleData = data.map(d => ({ time: d.date, open: d.open, high: d.high, low: d.low, close: d.close }));
        const volumeData = data.map(d => ({ time: d.date, value: d.volume, color: d.close >= d.open ? 'rgba(0, 200, 100, 0.5)' : 'rgba(200, 0, 0, 0.5)' }));

        this.candleSeries.setData(candleData);
        this.volumeSeries.setData(volumeData);
        this.chart.timeScale().fitContent();
    }

    destroy() {
        if (this.chart) {
            this.chart.remove();
            this.chart = null;
            this.candleSeries = null;
            this.volumeSeries = null;
        }
        const container = document.getElementById(this.containerId);
        if (container) container.innerHTML = '';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// NaverStyleStrategy — 네이버 금융 스타일 차트 (LightweightCharts v4)
// Features: 진짜 캔들스틱, MA5/20/60/120, 거래량, 최고/최저 마커,
//           OHLCV 툴팁, MA 범례, Linear/Log 전환, 크로스헤어
// ─────────────────────────────────────────────────────────────────────────────
class NaverStyleStrategy extends StockChartStrategy {
    constructor(containerId, height) {
        super(containerId, height);
        this.candleSeries = null;
        this.volumeSeries = null;
        this.maSeries = {};
        this._tooltipEl = null;
        this._legendEl = null;
        this._resizeObserver = null;
        this._isLog = false;
    }

    // ── MA 계산 ──────────────────────────────────────────────────────────────
    _calcMA(data, period) {
        const result = [];
        for (let i = period - 1; i < data.length; i++) {
            let sum = 0;
            for (let j = i - period + 1; j <= i; j++) sum += data[j].close;
            result.push({ time: data[i].date, value: sum / period });
        }
        return result;
    }

    // ── 최고/최저 마커 ────────────────────────────────────────────────────────
    _getMarkers(data) {
        if (!data || data.length < 2) return [];
        let highIdx = 0, lowIdx = 0;
        for (let i = 1; i < data.length; i++) {
            if (data[i].high > data[highIdx].high) highIdx = i;
            if (data[i].low  < data[lowIdx].low)  lowIdx  = i;
        }
        const lastClose = data[data.length - 1].close;
        const highPct = ((lastClose - data[highIdx].high) / data[highIdx].high * 100).toFixed(2);
        const lowPct  = ((lastClose - data[lowIdx].low)  / data[lowIdx].low  * 100).toFixed(2);
        const sign    = v => (v >= 0 ? '+' : '') + v;

        const markers = [
            {
                time: data[highIdx].date,
                position: 'aboveBar',
                color: '#ef4444',
                shape: 'arrowDown',
                text: `최고 ${data[highIdx].high.toLocaleString()} (${sign(highPct)}%)`
            },
            {
                time: data[lowIdx].date,
                position: 'belowBar',
                color: '#3b82f6',
                shape: 'arrowUp',
                text: `최저 ${data[lowIdx].low.toLocaleString()} (${sign(lowPct)}%)`
            }
        ];
        // LightweightCharts는 markers를 시간 오름차순으로 요구
        return markers.sort((a, b) => (a.time < b.time ? -1 : 1));
    }

    // ── MA 범례 HTML ──────────────────────────────────────────────────────────
    _maLegendHtml(maValues) {
        const cfg = [
            { period: 5,   label: 'MA5',   color: '#e8661e' },
            { period: 20,  label: 'MA20',  color: '#f5ac3e' },
            { period: 60,  label: 'MA60',  color: '#c4335d' },
            { period: 120, label: 'MA120', color: '#8b52b0' },
        ];
        return cfg
            .filter(c => maValues[c.period] != null)
            .map(c => `<span style="color:${c.color};margin-right:8px"><b>${c.label}</b> ${Math.round(maValues[c.period]).toLocaleString()}</span>`)
            .join('');
    }

    // ── init ─────────────────────────────────────────────────────────────────
    init() {
        if (typeof LightweightCharts === 'undefined') {
            console.error('[NaverStyleStrategy] LightweightCharts not loaded');
            return false;
        }
        const container = document.getElementById(this.containerId);
        if (!container) return false;

        container.style.position = 'relative';
        container.innerHTML = '';

        // OHLCV 툴팁 오버레이 (좌상단)
        this._tooltipEl = document.createElement('div');
        this._tooltipEl.style.cssText = [
            'position:absolute', 'top:8px', 'left:8px', 'z-index:20',
            'background:rgba(255,255,255,0.92)', 'border:1px solid #e0e0e0',
            'border-radius:4px', 'padding:5px 10px', 'font-size:12px',
            'pointer-events:none', 'display:none', 'line-height:1.8',
            'box-shadow:0 1px 4px rgba(0,0,0,0.08)'
        ].join(';');
        container.appendChild(this._tooltipEl);

        // MA 범례 오버레이 (우상단)
        this._legendEl = document.createElement('div');
        this._legendEl.style.cssText = [
            'position:absolute', 'top:8px', 'right:8px', 'z-index:20',
            'background:rgba(255,255,255,0.88)', 'border:1px solid #eee',
            'border-radius:4px', 'padding:4px 10px', 'font-size:11px',
            'pointer-events:none', 'line-height:2'
        ].join(';');
        container.appendChild(this._legendEl);

        // 차트 div (툴팁/범례 뒤)
        const chartDiv = document.createElement('div');
        chartDiv.style.cssText = 'position:absolute;inset:0;';
        container.appendChild(chartDiv);

        // LightweightCharts 생성
        this.chart = LightweightCharts.createChart(chartDiv, {
            width: container.offsetWidth || 800,
            height: this.height,
            layout: {
                background: { type: 'solid', color: '#ffffff' },
                textColor: '#333'
            },
            grid: {
                vertLines: { color: '#f5f5f5' },
                horzLines: { color: '#f5f5f5' }
            },
            crosshair: { mode: 1 }, // Magnet
            rightPriceScale: { borderColor: '#e0e0e0' },
            timeScale: {
                borderColor: '#e0e0e0',
                timeVisible: true,
                rightOffset: 8
            }
        });

        // 캔들스틱 시리즈
        this.candleSeries = this.chart.addCandlestickSeries({
            upColor:        '#ef4444',
            downColor:      '#3b82f6',
            borderUpColor:  '#ef4444',
            borderDownColor:'#3b82f6',
            wickUpColor:    '#ef4444',
            wickDownColor:  '#3b82f6',
            lastValueVisible: true
        });

        // 거래량 히스토그램 시리즈
        this.volumeSeries = this.chart.addHistogramSeries({
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
            lastValueVisible: false
        });
        this.volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.78, bottom: 0 }
        });

        // MA 라인 시리즈 (5, 20, 60, 120)
        const maConfig = [
            { period: 5,   color: '#e8661e' },
            { period: 20,  color: '#f5ac3e' },
            { period: 60,  color: '#c4335d' },
            { period: 120, color: '#8b52b0' },
        ];
        for (const { period, color } of maConfig) {
            this.maSeries[period] = this.chart.addLineSeries({
                color,
                lineWidth: 1,
                lastValueVisible: false,
                priceLineVisible: false,
                crosshairMarkerVisible: false
            });
        }

        // 크로스헤어 이동 → OHLCV 툴팁 + MA 범례 업데이트
        this.chart.subscribeCrosshairMove(param => {
            if (!param.time || !param.seriesData || !this._tooltipEl) {
                if (this._tooltipEl) this._tooltipEl.style.display = 'none';
                return;
            }
            const candle = param.seriesData.get(this.candleSeries);
            if (!candle) { this._tooltipEl.style.display = 'none'; return; }

            const upClr   = '#ef4444';
            const downClr = '#3b82f6';
            const dir     = candle.close >= candle.open ? upClr : downClr;

            this._tooltipEl.style.display = 'block';
            this._tooltipEl.innerHTML =
                `<span style="color:#888;font-size:11px">${param.time}</span>` +
                `&nbsp;&nbsp;시<b style="color:${dir};margin-left:3px">${(candle.open  || 0).toLocaleString()}</b>` +
                `&nbsp;고<b style="color:${upClr};margin-left:3px">${(candle.high  || 0).toLocaleString()}</b>` +
                `&nbsp;저<b style="color:${downClr};margin-left:3px">${(candle.low   || 0).toLocaleString()}</b>` +
                `&nbsp;종<b style="color:${dir};margin-left:3px">${(candle.close || 0).toLocaleString()}</b>`;

            // MA 범례 실시간 업데이트
            const maValues = {};
            for (const period of [5, 20, 60, 120]) {
                const s = this.maSeries[period];
                if (!s) continue;
                const v = param.seriesData.get(s);
                if (v) maValues[period] = v.value;
            }
            if (this._legendEl) this._legendEl.innerHTML = this._maLegendHtml(maValues);
        });

        // 리사이즈 대응
        this._resizeObserver = new ResizeObserver(() => {
            if (this.chart && container.offsetWidth > 0) {
                this.chart.applyOptions({ width: container.offsetWidth });
            }
        });
        this._resizeObserver.observe(container);

        return true;
    }

    // ── update ────────────────────────────────────────────────────────────────
    update(data) {
        if (!this.chart || !data || data.length === 0) return;

        // 캔들 데이터
        const candleData = data.map(d => ({
            time: d.date, open: d.open, high: d.high, low: d.low, close: d.close
        }));
        this.candleSeries.setData(candleData);

        // 거래량 데이터
        const volumeData = data.map(d => ({
            time: d.date,
            value: d.volume,
            color: d.close >= d.open ? 'rgba(239,68,68,0.45)' : 'rgba(59,130,246,0.45)'
        }));
        this.volumeSeries.setData(volumeData);

        // MA 라인
        const lastMaValues = {};
        for (const period of [5, 20, 60, 120]) {
            const maData = this._calcMA(data, period);
            if (this.maSeries[period]) {
                this.maSeries[period].setData(maData);
                if (maData.length > 0) lastMaValues[period] = maData[maData.length - 1].value;
            }
        }

        // 최고/최저 마커
        const markers = this._getMarkers(data);
        this.candleSeries.setMarkers(markers);

        // MA 범례 초기값 (마지막 데이터 기준)
        if (this._legendEl) this._legendEl.innerHTML = this._maLegendHtml(lastMaValues);

        this.chart.timeScale().fitContent();
    }

    // ── Linear / Log 전환 ─────────────────────────────────────────────────────
    toggleScale() {
        this._isLog = !this._isLog;
        if (this.chart) {
            // 0 = Normal, 1 = Logarithmic
            this.chart.priceScale('right').applyOptions({ mode: this._isLog ? 1 : 0 });
        }
        return this._isLog;
    }

    // ── destroy ───────────────────────────────────────────────────────────────
    destroy() {
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        if (this.chart) {
            this.chart.remove();
            this.chart = null;
            this.candleSeries = null;
            this.volumeSeries = null;
            this.maSeries = {};
        }
        this._tooltipEl = null;
        this._legendEl  = null;
        const container = document.getElementById(this.containerId);
        if (container) container.innerHTML = '';
    }
}

// ── Factory ───────────────────────────────────────────────────────────────────
function createChart(containerId, type, options = {}) {
    const height = options.height || 350;
    if (type === 'naver')       return new NaverStyleStrategy(containerId, height);
    if (type === 'lightweight') return new LightweightStrategy(containerId, height);
    return new ChartJsStrategy(containerId, height);
}

window.createChart = createChart;
