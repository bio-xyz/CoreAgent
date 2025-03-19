"use strict";
// src/plugins/sources/ApiSource.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiSource = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
class ApiSource {
    constructor(config) {
        this.name = config.name;
        this.endpoint = config.endpoint;
        this.apiKey = config.apiKey;
    }
    async fetchItems() {
        console.log(`Fetching data from API endpoint: ${this.endpoint}`);
        const url = `${this.endpoint}&apiKey=${this.apiKey}`;
        const response = await (0, node_fetch_1.default)(url);
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }
        const jsonData = (await response.json());
        const articles = [];
        // jsonData.articles.map(item => ({
        //   source: this.name,
        //   title: item.title,
        //   link: item.url,
        //   date: item.publishedAt ? new Date(item.publishedAt) : null,
        //   content: item.content,
        //   description: item.description,
        // }));
        return articles;
    }
}
exports.ApiSource = ApiSource;
