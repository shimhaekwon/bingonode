/**
 * stock-common.js
 * Simple common utilities for stock prediction pages
 */

const stockList = [
    { ticker: "005930.KS", name: "Samsung Electronics" },
    { ticker: "000660.KS", name: "SK Hynix" },
    { ticker: "035420.KS", name: "NAVER" },
    { ticker: "051910.KS", name: "LG Energy Solution" },
    { ticker: "006400.KS", name: "Samsung SDI" },
    { ticker: "005490.KS", name: "POSCO Holdings" },
    { ticker: "035720.KS", name: "Kakao" },
    { ticker: "012330.KS", name: "Hyundai Mobis" },
    { ticker: "000270.KS", name: "Kia" },
    { ticker: "068270.KS", name: "Celltrion" },
];

// API Base URL (default to Node.js version, can be overridden by page)
const API_BASE = window.API_BASE || '/api/stock2';

// Cache for last prediction results { ticker: result }
const lastPredictResults = {};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Formatter
function formatPercent(value) {
    if (value === null || value === undefined) return '-';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
}

function getDirectionClass(value) {
    if (value > 0) return 'up';
    if (value < 0) return 'down';
    return 'flat';
}

function getDirectionText(value) {
    if (value > 0) return 'UP';
    if (value < 0) return 'DOWN';
    return 'FLAT';
}

// API
async function fetchAPI(url, data) {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return response.json();
}

// Render Functions
function renderStockButtons() {
    const container = document.getElementById('stockList');
    if (!container) return;
    container.innerHTML = stockList.map(stock => `
        <button class="btn btn-sm" onclick="predictStock('${stock.ticker}')">
            ${stock.name}
        </button>
    `).join('');
}

function renderResult(result) {
    const tbody = document.getElementById('resultsBody');
    if (!tbody) return;
    const stock = stockList.find(s => s.ticker === result.ticker);
    
    tbody.innerHTML = `
        <tr class="hover">
            <td>${result.ticker}</td>
            <td>${stock?.name || result.ticker}</td>
            <td>${result.last_date}</td>
            <td class="${getDirectionClass(result.actual_change)}">${formatPercent(result.actual_change)}</td>
            <td>${result.best_technique || '-'}</td>
            <td>${result.best_similarity ? (result.best_similarity * 100).toFixed(1) + '%' : '-'}</td>
            <td class="${getDirectionClass(result.next_day_prediction)}">${formatPercent(result.next_day_prediction)}</td>
            <td class="${getDirectionClass(result.next_day_prediction)}">${getDirectionText(result.next_day_prediction)}</td>
        </tr>
    `;
}

function renderResults(results) {
    const tbody = document.getElementById('resultsBody');
    if (!tbody) return;
    
    if (!results || results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No results</td></tr>';
        return;
    }

    tbody.innerHTML = results.map(result => {
        if (result.error) {
            return `
                <tr class="hover" data-ticker="${result.ticker}">
                    <td>${result.ticker}</td>
                    <td>${result.name || result.ticker}</td>
                    <td colspan="6" class="text-error">Error: ${result.error}</td>
                </tr>
            `;
        }

        return `
            <tr class="hover cursor-pointer" data-ticker="${result.ticker}">
                <td>${result.ticker}</td>
                <td>${result.name || result.ticker}</td>
                <td>${result.last_date}</td>
                <td class="${getDirectionClass(result.actual_change)}">${formatPercent(result.actual_change)}</td>
                <td>${result.best_technique || '-'}</td>
                <td>${result.best_similarity ? (result.best_similarity * 100).toFixed(1) + '%' : '-'}</td>
                <td class="${getDirectionClass(result.next_day_prediction)}">${formatPercent(result.next_day_prediction)}</td>
                <td class="${getDirectionClass(result.next_day_prediction)}">${getDirectionText(result.next_day_prediction)}</td>
            </tr>
        `;
    }).join('');
}

// Loading
function showLoading() {
    const el = document.getElementById('loading');
    if (el) el.classList.remove('hidden');
}

function hideLoading() {
    const el = document.getElementById('loading');
    if (el) el.classList.add('hidden');
}

// Data Fetching
const stockDataCache = {}; // { ticker: { data, expireAt } }
async function fetchStockData(ticker, days = 365) {
    const cached = stockDataCache[ticker];
    if (cached && cached.expireAt > Date.now()) return cached.data;
    try {
        const result = await fetchAPI(`${API_BASE}/data`, { ticker, days });
        if (result.success && result.data) {
            stockDataCache[ticker] = { data: result.data, expireAt: Date.now() + CACHE_TTL_MS };
            return result.data;
        }
        return [];
    } catch (error) {
        console.error('Failed to fetch stock data:', error);
        return [];
    }
}

// Prediction
async function predictStock(ticker) {
    showLoading();
    try {
        const result = await fetchAPI(`${API_BASE}/predict`, { ticker });
        if (result.success) {
            lastPredictResults[ticker] = result;
            renderResult(result);
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
    hideLoading();
}

async function predictAll() {
    showLoading();
    try {
        const result = await fetchAPI(`${API_BASE}/predictAll`, { trainingDays: 240, threshold: 0.5 });
        if (result.success) {
            result.results.forEach(r => { if (r.success !== false) lastPredictResults[r.ticker] = r; });
            renderResults(result.results);
        } else {
            alert('Error: ' + result.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
    hideLoading();
}

// Modal & Details
let chartInstance = null;

async function showDetail(ticker) {
    const modal = document.getElementById('detailModal');
    if (!modal) return;

    showLoading();
    try {
        // Reuse cached result if available, otherwise fetch
        let result = lastPredictResults[ticker];
        if (!result) {
            result = await fetchAPI(`${API_BASE}/predict`, { ticker });
            if (!result.success) {
                alert('Error: ' + result.error);
                return;
            }
            lastPredictResults[ticker] = result;
        }

        const stockData = await fetchStockData(ticker, 365);
        const stock = stockList.find(s => s.ticker === ticker);
        const modalTitle = document.getElementById('modalTitle');
        modalTitle.textContent = stock?.name || ticker;
        modalTitle.dataset.ticker = ticker;

        const techniques = Object.entries(result.all_similarities || {})
            .sort((a, b) => b[1] - a[1])
            .map(([name, sim]) => `<tr><td>${name}</td><td>${(sim * 100).toFixed(1)}%</td></tr>`)
            .join('');

        document.getElementById('modalContent').innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <h4 class="font-bold">Info</h4>
                    <p>Ticker: ${result.ticker}</p>
                    <p>Last Date: ${result.last_date}</p>
                    <p>Last Close: ${result.last_close?.toLocaleString()}</p>
                    <p>Actual Change: ${formatPercent(result.actual_change)}</p>
                </div>
                <div>
                    <h4 class="font-bold">Prediction</h4>
                    <p>Next Day: ${formatPercent(result.next_day_prediction)}</p>
                    <p>Direction: <span class="${getDirectionClass(result.next_day_prediction)}">${getDirectionText(result.next_day_prediction)}</span></p>
                    <p>Best Technique: ${result.best_technique}</p>
                    <p>Best Similarity: ${(result.best_similarity * 100).toFixed(1)}%</p>
                </div>
            </div>
            <div class="mt-4">
                <h4 class="font-bold">All Techniques</h4>
                <div class="max-h-40 overflow-y-auto">
                    <table class="table table-sm">
                        <thead><tr><th>Technique</th><th>Similarity</th></tr></thead>
                        <tbody>${techniques}</tbody>
                    </table>
                </div>
            </div>
        `;

        modal.showModal();

        setTimeout(async () => {
            if (stockData.length > 0) {
                if (chartInstance) {
                    chartInstance.destroy();
                }
                
                if (typeof window.initChart === 'function') {
                    chartInstance = window.initChart();
                }
                
                if (chartInstance) {
                    chartInstance.update(stockData);
                }
            }
        }, 200);

    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Timeframe: D = daily 365 days, W = weekly 2 years, M = monthly 5 years
async function changeTimeframe(period) {
    if (!chartInstance) return;
    const modal = document.getElementById('detailModal');
    if (!modal || !modal.open) return;

    const title = document.getElementById('modalTitle');
    const ticker = title ? title.dataset.ticker : null;
    if (!ticker) return;

    const daysMap = { D: 365, W: 730, M: 1825 };
    const days = daysMap[period] || 365;

    // Invalidate cache for this ticker to force fresh fetch
    delete stockDataCache[ticker];

    showLoading();
    try {
        const stockData = await fetchStockData(ticker, days);
        if (stockData.length > 0 && chartInstance) {
            chartInstance.update(stockData);
        }
    } finally {
        hideLoading();
    }
}

function closeDetailModal() {
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
    const modal = document.getElementById('detailModal');
    if (modal) modal.close();
}

// Export for global use
window.StockCommon = {
    stockList,
    fetchAPI,
    renderStockButtons,
    renderResult,
    renderResults,
    formatPercent,
    getDirectionClass,
    getDirectionText,
    showLoading,
    hideLoading,
    predictStock,
    predictAll,
    showDetail,
    closeDetailModal,
    changeTimeframe,
    fetchStockData
};

// Make changeTimeframe globally accessible (called from HTML onclick)
window.changeTimeframe = changeTimeframe;

