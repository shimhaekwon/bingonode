/**
 * stock.js
 * - Stock Prediction Vue Application
 * - Chart component with Chart.js
 */

// Vue 3 Application
const { createApp, ref, computed, onMounted, watch, nextTick } = Vue;

const StockApp = {
    components: {
        'stock-chart': StockChartComponent
    },
    setup() {
        // State
        const stockList = ref([
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
        ]);
        
        const API_BASE = '/api/stock2';
        const results = ref([]);
        const selectedStock = ref(null);
        const showModal = ref(false);
        const loading = ref(false);
        const predictionData = ref(null);
        const stockDataCache = {};
        
        // Chart component ref
        const chartComponent = ref(null);
        
        // Methods
        const formatPercent = (value) => {
            if (value === null || value === undefined) return '-';
            const sign = value >= 0 ? '+' : '';
            return `${sign}${value.toFixed(2)}%`;
        };
        
        const getDirectionClass = (value) => {
            if (value > 0) return 'text-red-500';
            if (value < 0) return 'text-blue-500';
            return 'text-gray-500';
        };
        
        const getDirectionText = (value) => {
            if (value > 0) return 'UP';
            if (value < 0) return 'DOWN';
            return 'FLAT';
        };
        
        const fetchAPI = async (url, data) => {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return response.json();
        };
        
        const predictStock = async (ticker) => {
            loading.value = true;
            try {
                const result = await fetchAPI(`${API_BASE}/predict`, { ticker });
                if (result.success) {
                    results.value = [result];
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                alert('Error: ' + error.message);
            }
            loading.value = false;
        };
        
        const predictAll = async () => {
            loading.value = true;
            try {
                const result = await fetchAPI(`${API_BASE}/predictAll`, { 
                    trainingDays: 240, 
                    threshold: 0.5 
                });
                if (result.success) {
                    results.value = result.results;
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (error) {
                alert('Error: ' + error.message);
            }
            loading.value = false;
        };
        
        const showDetail = async (ticker) => {
            console.log('[showDetail] Opening detail for:', ticker);
            
            try {
                // Fetch prediction data
                const result = await fetchAPI(`${API_BASE}/predict`, { ticker });
                if (!result.success) {
                    alert('Error: ' + result.error);
                    return;
                }
                predictionData.value = result;
                
                // Fetch stock data for chart
                let stockData = stockDataCache[ticker];
                if (!stockData) {
                    const dataResult = await fetchAPI(`${API_BASE}/data`, { 
                        ticker, 
                        days: 365 
                    });
                    if (dataResult.success && dataResult.data) {
                        stockData = dataResult.data;
                        stockDataCache[ticker] = stockData;
                    }
                }
                
                // Show modal and update chart
                selectedStock.value = stockList.value.find(s => s.ticker === ticker);
                showModal.value = true;
                
                // Wait for modal to render then update chart
                await nextTick();
                setTimeout(() => {
                    if (chartComponent.value && stockData) {
                        chartComponent.value.updateData(stockData);
                    }
                }, 200);
                
            } catch (error) {
                console.error('[showDetail] Error:', error);
                alert('Error: ' + error.message);
            }
        };
        
        const closeModal = () => {
            showModal.value = false;
            selectedStock.value = null;
            predictionData.value = null;
        };
        
        return {
            stockList,
            results,
            selectedStock,
            showModal,
            loading,
            predictionData,
            chartComponent,
            formatPercent,
            getDirectionClass,
            getDirectionText,
            predictStock,
            predictAll,
            showDetail,
            closeModal
        };
    },
    template: `
    <div class="container mx-auto p-4">
        <!-- Header -->
        <div class="text-center mb-8">
            <h1 class="text-4xl font-bold">Stock Prediction [Node.js]</h1>
            <p class="text-base-content/70 mt-2">AI-powered technical analysis (Pure Node.js)</p>
        </div>

        <!-- Stock Selection -->
        <div class="card bg-base-100 shadow-xl mb-6">
            <div class="card-body">
                <h2 class="card-title">Select Stock</h2>
                <div class="flex flex-wrap gap-2 mb-4">
                    <button 
                        v-for="stock in stockList" 
                        :key="stock.ticker"
                        class="btn btn-sm"
                        @click="predictStock(stock.ticker)"
                    >
                        {{ stock.name }}
                    </button>
                </div>
                <div class="flex gap-2">
                    <button class="btn btn-primary" @click="predictAll">Predict All</button>
                </div>
            </div>
        </div>

        <!-- Results -->
        <div class="card bg-base-100 shadow-xl">
            <div class="card-body">
                <h2 class="card-title">Prediction Results</h2>
                <div class="overflow-x-auto">
                    <table class="table table-zebra w-full">
                        <thead>
                            <tr>
                                <th>Ticker</th>
                                <th>Name</th>
                                <th>Last Date</th>
                                <th>Actual %</th>
                                <th>Best Technique</th>
                                <th>Similarity</th>
                                <th>Next Day %</th>
                                <th>Direction</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-if="results.length === 0">
                                <td colspan="8" class="text-center">Select a stock or click "Predict All"</td>
                            </tr>
                            <tr 
                                v-for="result in results" 
                                :key="result.ticker"
                                class="hover cursor-pointer"
                                :data-ticker="result.ticker"
                                @click="showDetail(result.ticker)"
                            >
                                <td>{{ result.ticker }}</td>
                                <td>{{ result.ticker }}</td>
                                <td>{{ result.last_date }}</td>
                                <td :class="getDirectionClass(result.actual_change)">{{ formatPercent(result.actual_change) }}</td>
                                <td>{{ result.best_technique || '-' }}</td>
                                <td>{{ result.best_similarity ? (result.best_similarity * 100).toFixed(1) + '%' : '-' }}</td>
                                <td :class="getDirectionClass(result.next_day_prediction)">{{ formatPercent(result.next_day_prediction) }}</td>
                                <td :class="getDirectionClass(result.next_day_prediction)">{{ getDirectionText(result.next_day_prediction) }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Detail Modal -->
        <dialog :class="showModal ? 'modal modal-open' : 'modal'" v-if="showModal">
            <div class="modal-box max-w-4xl w-11/12 max-w-5xl">
                <h3 class="font-bold text-lg mb-4">
                    {{ selectedStock?.name || 'Stock Details' }}
                </h3>
                
                <!-- Chart Component -->
                <stock-chart ref="chartComponent" id="stock-chart"></stock-chart>
                
                <!-- Details -->
                <div class="grid grid-cols-2 gap-4 mt-4">
                    <div>
                        <h4 class="font-bold">Info</h4>
                        <p>Ticker: {{ predictionData?.ticker }}</p>
                        <p>Last Date: {{ predictionData?.last_date }}</p>
                        <p>Last Close: {{ predictionData?.last_close?.toLocaleString() }}</p>
                        <p>Actual Change: {{ formatPercent(predictionData?.actual_change) }}</p>
                    </div>
                    <div>
                        <h4 class="font-bold">Prediction</h4>
                        <p>Next Day: {{ formatPercent(predictionData?.next_day_prediction) }}</p>
                        <p>Direction: <span :class="getDirectionClass(predictionData?.next_day_prediction)">
                            {{ getDirectionText(predictionData?.next_day_prediction) }}
                        </span></p>
                        <p>Best Technique: {{ predictionData?.best_technique }}</p>
                        <p>Best Similarity: {{ predictionData?.best_similarity ? (predictionData.best_similarity * 100).toFixed(1) + '%' : '-' }}</p>
                    </div>
                </div>
                <div class="mt-4">
                    <h4 class="font-bold">All Techniques</h4>
                    <div class="max-h-40 overflow-y-auto">
                        <table class="table table-sm">
                            <thead><tr><th>Technique</th><th>Similarity</th></tr></thead>
                            <tbody>
                                <tr v-for="(sim, name) in predictionData?.all_similarities" :key="name">
                                    <td>{{ name }}</td>
                                    <td>{{ (sim * 100).toFixed(1) }}%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-action">
                    <button class="btn" @click="closeModal">Close</button>
                </div>
            </div>
            <form method="dialog" class="modal-backdrop">
                <button @click="closeModal">close</button>
            </form>
        </dialog>

        <!-- Loading -->
        <div v-if="loading" class="fixed inset-0 bg-base-300/50 flex items-center justify-center z-50">
            <div class="text-center">
                <span class="loading loading-spinner loading-lg"></span>
                <p class="mt-2">Processing...</p>
            </div>
        </div>
    </div>
    `
};

// Stock Chart Component
const StockChartComponent = {
    props: {
        id: { type: String, default: 'stock-chart' },
        height: { type: Number, default: 350 }
    },
    setup(props) {
        const chartContainer = ref(null);
        let chart = null;
        
        const initChart = () => {
            if (!chartContainer.value) return;
            
            // Clear container
            chartContainer.value.innerHTML = '';
            
            const priceHeight = Math.floor(props.height * 0.7);
            const volumeHeight = props.height - priceHeight - 10;
            
            let html = `<div style="height: ${priceHeight}px; position: relative;">`;
            html += `<canvas id="${props.id}-price"></canvas>`;
            html += `</div>`;
            html += `<div style="height: ${volumeHeight}px; margin-top: 10px;">`;
            html += `<canvas id="${props.id}-volume"></canvas>`;
            html += `</div>`;
            
            chartContainer.value.innerHTML = html;
            
            const priceCtx = document.getElementById(`${props.id}-price`);
            const volumeCtx = document.getElementById(`${props.id}-volume`);
            
            if (priceCtx) {
                chart = {
                    price: new Chart(priceCtx, {
                        type: 'bar',
                        data: { labels: [], datasets: [] },
                        options: getPriceOptions()
                    }),
                    volume: new Chart(volumeCtx, {
                        type: 'bar',
                        data: { labels: [], datasets: [] },
                        options: getVolumeOptions()
                    })
                };
            }
        };
        
        const getPriceOptions = () => ({
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Price (KRW)', font: { size: 14 } }
            },
            scales: {
                x: { display: true, ticks: { maxTicksLimit: 10 } },
                y: { position: 'right', title: { display: true, text: 'Price' } }
            }
        });
        
        const getVolumeOptions = () => ({
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, title: { display: false } },
            scales: {
                x: { display: false },
                y: { position: 'right', title: { display: true, text: 'Volume' } }
            }
        });
        
        const updateData = (data) => {
            if (!chart || !data || data.length === 0) return;
            
            const displayData = data.slice(-60);
            const labels = displayData.map(d => d.date);
            
            const colors = displayData.map(d => 
                d.close >= d.open ? 'rgba(239, 68, 68, 0.7)' : 'rgba(59, 130, 246, 0.7)'
            );
            
            // Price chart
            chart.price.data.labels = labels;
            chart.price.data.datasets = [
                {
                    type: 'bar',
                    label: 'High-Low',
                    data: displayData.map(d => d.high - d.low),
                    backgroundColor: colors,
                    borderColor: colors.map(c => c.replace('0.7', '1')),
                    borderWidth: 1
                },
                {
                    type: 'line',
                    label: 'Close',
                    data: displayData.map(d => d.close),
                    borderColor: '#333',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1
                }
            ];
            chart.price.update();
            
            // Volume chart
            chart.volume.data.labels = labels;
            chart.volume.data.datasets = [{
                label: 'Volume',
                data: displayData.map(d => d.volume),
                backgroundColor: colors,
                borderWidth: 0
            }];
            chart.volume.update();
            
            console.log('[StockChart] Updated with', displayData.length, 'days');
        };
        
        onMounted(() => {
            initChart();
        });
        
        return {
            chartContainer,
            updateData
        };
    },
    template: `
        <div ref="chartContainer" :style="{ height: height + 'px' }"></div>
    `
};

// Mount Vue Application
document.addEventListener('DOMContentLoaded', () => {
    const app = createApp(StockApp);
    app.component('stock-chart', StockChartComponent);
    app.mount('#app');
});
