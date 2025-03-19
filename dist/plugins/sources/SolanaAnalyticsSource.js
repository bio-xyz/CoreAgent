"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolanaAnalyticsSource = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
class SolanaAnalyticsSource {
    constructor(config) {
        this.name = config.name;
        this.apiKey = config.apiKey;
        this.tokenAddresses = config.tokenAddresses;
    }
    async fetchItems() {
        let solanaResponse = [];
        for (const tokenAddress of this.tokenAddresses) {
            const apiUrl = `https://api.dexscreener.com/token-pairs/v1/solana/${tokenAddress}`;
            try {
                const response = await (0, node_fetch_1.default)(apiUrl, {
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                });
                if (!response.ok) {
                    throw new Error(`Failed to fetch data: ${response.statusText}`);
                }
                const data = await response.json();
                if (!data) {
                    throw new Error("Invalid Solana data format received.");
                }
                const solanaPair = data.find((pair) => pair.quoteToken.address === "So11111111111111111111111111111111111111112");
                const analytics = solanaPair;
                const summaryItem = {
                    type: "solanaTokenAnalytics",
                    title: `Daily Analytics for ${analytics.baseToken.symbol}/${analytics.quoteToken.symbol}`,
                    cid: `analytics-${tokenAddress}-${new Date().getDate()}`,
                    source: this.name,
                    text: `Symbol: ${analytics.baseToken.symbol} Current Price: $${analytics.priceUsd}\nVolume (24h): $${analytics.volume.h24}\nMarket Cap: $${analytics.marketCap}\nDaily Change: ${analytics.priceChange.h24}`,
                    date: Math.floor(new Date().getTime() / 1000),
                    link: `https://dexscreener.com/solana/${tokenAddress}`,
                    metadata: {
                        price: analytics.priceUsd,
                        volume_24h: analytics.volume.h24,
                        market_cap: analytics.marketCap,
                        price_change_percentage_24h: analytics.priceChange.h24,
                        buy_txns_24h: analytics.txns.h24.buys,
                        sell_txns_24h: analytics.txns.h24.sells,
                    },
                };
                solanaResponse.push(summaryItem);
            }
            catch (error) {
                console.error("Error fetching analytics data:", error);
            }
        }
        return solanaResponse;
    }
}
exports.SolanaAnalyticsSource = SolanaAnalyticsSource;
