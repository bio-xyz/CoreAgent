"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodexAnalyticsSource = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
class CodexAnalyticsSource {
    constructor(config) {
        this.name = config.name;
        this.apiKey = config.apiKey;
        this.tokenAddresses = config.tokenAddresses;
    }
    async fetchItems() {
        const codexResponse = [];
        try {
            let analytics = await this.getTokenDetails(this.tokenAddresses);
            if (analytics && analytics.length > 0) {
                for (const analytic of analytics) {
                    if (analytic.token.cmcId) {
                        const summaryItem = {
                            type: "codexTokenAnalytics",
                            title: `Daily Analytics for ${analytic.token.symbol}`,
                            cid: `analytics-${analytic.token.address}-${new Date().getDate()}`,
                            source: this.name,
                            text: `Symbol: ${analytic.token.symbol}\n Current Price: $${analytic.priceUSD}\nVolume (24h): $${analytic.volume24}\nMarket Cap: $${analytic.marketCap}\nDaily Change: ${analytic.change24}`,
                            date: Math.floor(Date.now() / 1000),
                            link: '',
                            metadata: {
                                price: analytic.priceUSD,
                                volume_24h: analytic.volume24,
                                market_cap: analytic.marketCap,
                                price_change_percentage_24h: analytic.change24,
                                buy_txns_24h: analytic.buyCount24,
                                sell_txns_24h: analytic.sellCount24,
                            },
                        };
                        codexResponse.push(summaryItem);
                    }
                }
            }
        }
        catch (error) {
            console.error("Error fetching analytics data:", error);
        }
        return codexResponse;
    }
    async fetchHistorical(date) {
        const targetDate = new Date(date).getTime() / 1000;
        const codexResponse = [];
        try {
            let analytics = await this.getTokenDetails(this.tokenAddresses);
            let prices = await this.getTokenPrices(analytics.map((analytic) => { if (analytic.token.cmcId)
                return { "address": analytic.token.address, "networkId": analytic.token.networkId, "timestamp": targetDate }; }).filter((analytic) => { return !!analytic; }));
            if (analytics && analytics.length > 0) {
                for (const analytic of analytics) {
                    if (analytic.token.cmcId) {
                        let price = prices.find((_price) => _price.address === analytic.token.address);
                        if (price) {
                            const summaryItem = {
                                type: "codexTokenAnalytics",
                                title: `Daily Analytics for ${analytic.token.symbol}`,
                                cid: `analytics-${analytic.token.address}-${date.substring(8, 10)}`,
                                source: this.name,
                                text: `Symbol: ${analytic.token.symbol}\n Current Price: $${price.priceUsd}`,
                                date: targetDate,
                                link: '',
                                metadata: {
                                    price: price.priceUsd,
                                },
                            };
                            codexResponse.push(summaryItem);
                        }
                    }
                }
            }
        }
        catch (error) {
            console.error("Error fetching analytics data:", error);
        }
        return codexResponse;
    }
    async getTokenPrices(addresses) {
        const query = `
    {
        getTokenPrices(
            inputs: ${JSON.stringify(addresses).replace(/"([^(")"]+)":/g, "$1:")}
        ) {
            address
            networkId
            priceUsd
        }
    }
    `;
        try {
            const responseData = await this.makeGraphQLQuery(query);
            let prices = responseData?.data?.getTokenPrices || [];
            return prices;
        }
        catch (error) {
            return [];
        }
    }
    async getTokenDetails(addresses) {
        const query = `
    {
        filterTokens(tokens: ${JSON.stringify(this.tokenAddresses)}) {
            results {
                change24
                high24
                low24
                volume24
                volumeChange24
                liquidity
                marketCap
                priceUSD
                sellCount24
                buyCount24
                token {
                    cmcId
                    address
                    decimals
                    name
                    networkId
                    symbol
                }
            }
        }
    }
    `;
        try {
            const responseData = await this.makeGraphQLQuery(query);
            let analytics = responseData?.data?.filterTokens?.results || [];
            return analytics;
        }
        catch (error) {
            return [];
        }
    }
    async makeGraphQLQuery(query) {
        try {
            const response = await (0, node_fetch_1.default)("https://graph.codex.io/graphql", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `${this.apiKey}`,
                },
                body: JSON.stringify({ "query": query }),
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch data: ${response.statusText}`);
            }
            const responseData = await response.json();
            if (responseData.errors) {
                console.error("GraphQL errors:", responseData.errors);
                throw new Error("GraphQL error occurred.");
            }
            return responseData;
        }
        catch (error) {
            console.error(error);
            return;
        }
    }
}
exports.CodexAnalyticsSource = CodexAnalyticsSource;
