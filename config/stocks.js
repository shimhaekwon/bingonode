// config/stocks.js
/**
 * Korean stock list - single source of truth
 * Used by stockFetcher.js and stockService.js
 */

const KOREAN_STOCKS = [
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

module.exports = KOREAN_STOCKS;
