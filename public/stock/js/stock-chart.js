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

// Chart.js Strategy
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
        const displayData = data.slice(-60);
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

function createChart(containerId, type, options = {}) {
    const height = options.height || 350;
    if (type === 'lightweight') return new LightweightStrategy(containerId, height);
    return new ChartJsStrategy(containerId, height);
}

window.createChart = createChart;

