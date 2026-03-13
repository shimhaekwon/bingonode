/**
 * StockChart.js
 * - Stock candlestick chart component using Chart.js
 * - Displays price and volume data
 */

class StockChart {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        
        this.options = {
            height: options.height || 300,
            width: options.width || '100%',
            showVolume: options.showVolume !== false,
            ...options
        };
        
        this.priceChart = null;
        this.volumeChart = null;
    }

    /**
     * Initialize the chart with container
     */
    init() {
        if (!this.container) {
            console.error('[StockChart] Container not found:', this.containerId);
            return false;
        }
        
        // Clear and setup container
        this.container.innerHTML = '';
        this.container.style.height = this.options.height + 'px';
        
        // Create canvas elements
        const priceHeight = this.options.showVolume ? 
            Math.floor(this.options.height * 0.7) : 
            this.options.height;
        const volumeHeight = this.options.showVolume ? 
            this.options.height - priceHeight - 10 : 
            0;
        
        let html = `<div style="height: ${priceHeight}px; position: relative;">`;
        html += `<canvas id="${this.containerId}-price"></canvas>`;
        html += `</div>`;
        
        if (this.options.showVolume && volumeHeight > 0) {
            html += `<div style="height: ${volumeHeight}px; margin-top: 10px;">`;
            html += `<canvas id="${this.containerId}-volume"></canvas>`;
            html += `</div>`;
        }
        
        this.container.innerHTML = html;
        
        // Get canvas contexts
        const priceCtx = document.getElementById(`${this.containerId}-price`);
        const volumeCtx = this.options.showVolume ? 
            document.getElementById(`${this.containerId}-volume`) : 
            null;
        
        if (!priceCtx) {
            console.error('[StockChart] Price canvas not found');
            return false;
        }
        
        // Initialize Chart.js instances
        this.priceChart = new Chart(priceCtx, {
            type: 'bar',
            data: { labels: [], datasets: [] },
            options: this.getPriceOptions()
        });
        
        if (volumeCtx && this.options.showVolume) {
            this.volumeChart = new Chart(volumeCtx, {
                type: 'bar',
                data: { labels: [], datasets: [] },
                options: this.getVolumeOptions()
            });
        }
        
        console.log('[StockChart] Initialized successfully');
        return true;
    }

    /**
     * Get price chart options
     */
    getPriceOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { 
                    display: true, 
                    text: 'Price (KRW)',
                    font: { size: 14 }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            return `Close: ${ctx.raw.toLocaleString()} KRW`;
                        }
                    }
                }
            },
            scales: {
                x: { 
                    display: true, 
                    ticks: { maxTicksLimit: 10 }
                },
                y: { 
                    position: 'right',
                    title: { display: true, text: 'Price' }
                }
            }
        };
    }

    /**
     * Get volume chart options
     */
    getVolumeOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: false }
            },
            scales: {
                x: { display: false },
                y: { 
                    position: 'right',
                    title: { display: true, text: 'Volume' }
                }
            }
        };
    }

    /**
     * Update chart with stock data
     * @param {Array} data - Array of {date, open, high, low, close, volume}
     * @param {number} displayDays - Number of days to display (default: 60)
     */
    update(data, displayDays = 60) {
        if (!data || data.length === 0) {
            console.warn('[StockChart] No data to display');
            return;
        }
        
        // Use last N days
        const displayData = data.slice(-displayDays);
        
        // Prepare labels
        const labels = displayData.map(d => d.date);
        
        // Calculate price changes (high-low as bars)
        const priceData = displayData.map(d => ({
            x: d.date,
            high: d.high,
            low: d.low,
            close: d.close,
            open: d.open
        }));
        
        // Color based on price movement
        const priceColors = displayData.map(d => 
            d.close >= d.open ? 'rgba(239, 68, 68, 0.7)' : 'rgba(59, 130, 246, 0.7)'
        );
        
        const borderColors = displayData.map(d => 
            d.close >= d.open ? 'rgba(239, 68, 68, 1)' : 'rgba(59, 130, 246, 1)'
        );
        
        // Update price chart - show high-low range as bars
        this.priceChart.data.labels = labels;
        this.priceChart.data.datasets = [{
            type: 'bar',
            label: 'High-Low',
            data: displayData.map(d => d.high - d.low),
            backgroundColor: priceColors,
            borderColor: borderColors,
            borderWidth: 1
        }, {
            type: 'line',
            label: 'Close',
            data: displayData.map(d => d.close),
            borderColor: '#333',
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            yAxisID: 'y'
        }];
        
        this.priceChart.update();
        
        // Update volume chart
        if (this.volumeChart) {
            this.volumeChart.data.labels = labels;
            this.volumeChart.data.datasets = [{
                label: 'Volume',
                data: displayData.map(d => d.volume),
                backgroundColor: priceColors,
                borderWidth: 0
            }];
            this.volumeChart.update();
        }
        
        console.log('[StockChart] Updated with', displayData.length, 'days of data');
    }

    /**
     * Destroy charts
     */
    destroy() {
        if (this.priceChart) {
            this.priceChart.destroy();
            this.priceChart = null;
        }
        if (this.volumeChart) {
            this.volumeChart.destroy();
            this.volumeChart = null;
        }
        if (this.container) {
            this.container.innerHTML = '';
        }
        console.log('[StockChart] Destroyed');
    }

    /**
     * Resize chart
     */
    resize() {
        if (this.priceChart) {
            this.priceChart.resize();
        }
        if (this.volumeChart) {
            this.volumeChart.resize();
        }
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StockChart;
}
