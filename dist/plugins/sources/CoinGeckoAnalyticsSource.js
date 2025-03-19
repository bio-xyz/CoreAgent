"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoinGeckoAnalyticsSource = void 0;
const generalHelper_1 = require("../../helpers/generalHelper");
const node_fetch_1 = __importDefault(require("node-fetch"));
class CoinGeckoAnalyticsSource {
    constructor(config) {
        this.name = config.name;
        this.tokenSymbols = config.tokenSymbols;
    }
    async fetchItems() {
        let marketResponse = [];
        for (const symbol of this.tokenSymbols) {
            const apiUrl = `https://api.coingecko.com/api/v3/coins/${symbol}`;
            try {
                const response = await (0, node_fetch_1.default)(apiUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch market data: ${response.statusText}`);
                }
                const data = await response.json();
                if (!data || !data.market_data) {
                    throw new Error("Invalid market data format received from API.");
                }
                const marketData = data.market_data;
                const summaryItem = {
                    type: "coinGeckoMarketAnalytics",
                    title: `Market Analytics for ${data.name} (${data.symbol.toUpperCase()})`,
                    cid: `analytics-${symbol}-${new Date().getDate()}`,
                    source: this.name,
                    text: `Symbol: ${symbol} Current Price: $${marketData.current_price.usd}\nVolume (24h): $${marketData.total_volume.usd}\nMarket Cap: $${marketData.market_cap.usd}\nDaily Change: ${marketData.price_change_24h}.`,
                    date: Math.floor(new Date().getTime() / 1000),
                    link: `https://www.coingecko.com/en/coins/${symbol}`,
                    metadata: {
                        price: marketData.current_price.usd,
                        volume_24h: marketData.total_volume.usd,
                        market_cap: marketData.market_cap.usd,
                        price_change_24h: marketData.price_change_24h,
                        price_change_percentage_24h: marketData.price_change_percentage_24h,
                        high_24h: marketData.high_24h.usd,
                        low_24h: marketData.low_24h.usd,
                    },
                };
                marketResponse.push(summaryItem);
                await (0, generalHelper_1.delay)(2000);
            }
            catch (error) {
                await (0, generalHelper_1.delay)(2000);
                console.error("Error fetching market data:", error);
            }
        }
        return marketResponse;
    }
}
exports.CoinGeckoAnalyticsSource = CoinGeckoAnalyticsSource;
