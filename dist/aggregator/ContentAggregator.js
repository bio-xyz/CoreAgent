"use strict";
// src/aggregator/ContentAggregator.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentAggregator = void 0;
class ContentAggregator {
    constructor() {
        this.sources = [];
        this.enrichers = [];
        this.storage = undefined;
    }
    registerSource(source) {
        this.sources.push(source);
    }
    registerEnricher(enricher) {
        this.enrichers.push(enricher);
    }
    registerStorage(storage) {
        this.storage = storage;
    }
    /**
     * Save items source
     */
    async saveItems(items, sourceName) {
        if (!this.storage) {
            console.error(`Error aggregator storage hasn't be set.`);
            return;
        }
        try {
            if (items.length > 0) {
                await this.storage.saveContentItems(items);
                console.log(`Stored ${items.length} items from source: ${sourceName}`);
            }
            else {
                console.log(`No new items fetched from source: ${sourceName}`);
            }
        }
        catch (error) {
            console.error(`Error fetching/storing data from source ${sourceName}:`, error);
        }
    }
    /**
     * Fetch items from all registered sources
     */
    async fetchAll() {
        let allItems = [];
        try {
            for (const source of this.sources) {
                const items = await source.fetchItems();
                allItems = allItems.concat(items);
            }
            allItems = await this.processItems(allItems);
            // Apply each enricher to the entire articles array
            for (const enricher of this.enrichers) {
                allItems = await enricher.enrich(allItems);
            }
        }
        catch (error) {
            console.error(`Error Fetch All: `, error);
        }
        return allItems;
    }
    /**
     * Fetch items from all registered sources
     */
    async fetchSource(sourceName) {
        let allItems = [];
        for (const source of this.sources) {
            try {
                if (source.name === sourceName) {
                    const items = await source.fetchItems();
                    allItems = allItems.concat(items);
                }
            }
            catch (error) {
                console.error(`Error fetching from ${source.name}:`, error);
            }
        }
        allItems = await this.processItems(allItems);
        // Apply each enricher to the entire articles array
        for (const enricher of this.enrichers) {
            allItems = await enricher.enrich(allItems);
        }
        return allItems;
    }
    async fetchAndStore(sourceName) {
        try {
            console.log(`Fetching data from source: ${sourceName}`);
            const items = await this.fetchSource(sourceName);
            await this.saveItems(items, sourceName);
        }
        catch (error) {
            console.error(`Error fetching/storing data from source ${sourceName}:`, error);
        }
    }
    ;
    async processItems(items) {
        if (!this.storage) {
            throw ("Storage Plugin is not set for Aggregator.");
        }
        let allItems = [];
        for (const item of items) {
            if (item && item.cid) {
                const exists = await this.storage.getContentItem(item.cid);
                if (!exists) {
                    allItems.push(item);
                }
            }
        }
        return allItems;
    }
}
exports.ContentAggregator = ContentAggregator;
