// src/aggregator/ContentAggregator.ts

import { ContentSource } from "../plugins/sources/ContentSource";
import { StoragePlugin } from "../plugins/storage/StoragePlugin";
import { ContentItem, EnricherPlugin } from "../types";

export class HistoricalAggregator {
  private sources: ContentSource[] = [];
  private enrichers: EnricherPlugin[] = [];
  private storage: StoragePlugin | undefined = undefined;

  public registerSource(source: ContentSource) {
    this.sources.push(source);
  }
  
  public registerEnricher(enricher: EnricherPlugin): void {
    this.enrichers.push(enricher);
  }
  
  public registerStorage(storage: StoragePlugin): void {
    this.storage = storage;
  }
  
  /**
   * Save items source
   */
  public async saveItems(items : ContentItem[], sourceName : string) {
    if (! this.storage) {
      console.error(`Error aggregator storage hasn't be set.`);
      return
    }

    try {
      if (items.length > 0) {
        await this.storage.saveContentItems(items);
        console.log(`Stored ${items.length} items from source: ${sourceName}`);
      } else {
        console.log(`No new items fetched from source: ${sourceName}`);
      }
    } catch (error) {
      console.error(`Error fetching/storing data from source ${sourceName}:`, error);
    }
  }

  /**
   * Fetch items from all registered sources
   */
  public async fetchAll(date: string): Promise<ContentItem[]> {
    let allItems: ContentItem[] = [];
    for (const source of this.sources) {
      try {
        if ( source.fetchHistorical ) {
          const items = await source.fetchHistorical(date);
          allItems = allItems.concat(items);
        }
      } catch (error) {
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

  /**
   * Fetch items from all registered sources
   */
  public async fetchSource(sourceName: string, date: string): Promise<ContentItem[]> {
    let allItems: ContentItem[] = [];
    for (const source of this.sources) {
      try {
        if ( source.name === sourceName ) {
          if ( source.fetchHistorical ) {
            const items = await source.fetchHistorical(date);
            allItems = allItems.concat(items);
          }
        }
      } catch (error) {
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
  
  public async fetchAndStore(sourceName: string, date : string) {
    try {
      console.log(`Fetching data from source: ${sourceName}`);
      const items = await this.fetchSource(sourceName, date);
      await this.saveItems(items, sourceName);
    } catch (error) {
      console.error(`Error fetching/storing data from source ${sourceName}:`, error);
    }
  };

  public async processItems(items: ContentItem[]): Promise<ContentItem[]> {
    if (! this.storage) {
      throw("Storage Plugin is not set for Aggregator.")
    }

    let allItems: ContentItem[] = [];
    for (const item of items) {
      if ( item && item.cid ) {
        const exists = await this.storage.getContentItem(item.cid);
        if (! exists) {
          allItems.push(item)
        }
      }
    }
    
    return allItems;
  };
}