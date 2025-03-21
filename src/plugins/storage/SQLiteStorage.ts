// src/plugins/storage/UnifiedStorage.ts

import { StoragePlugin } from "./StoragePlugin"; // a small interface if you like
import { open, Database } from "sqlite";
import sqlite3 from "sqlite3";
import { ContentItem, SummaryItem, StorageConfig } from "../../types";

export class SQLiteStorage implements StoragePlugin {
  public name: string;
  private db: Database<sqlite3.Database, sqlite3.Statement> | null = null;
  private dbPath: string;

  constructor(config: StorageConfig) {
    this.name = config.name;
    this.dbPath = config.dbPath;
  }

  public async init(): Promise<void> {
    this.db = await open({ filename: this.dbPath, driver: sqlite3.Database });

    // Create the items table if it doesn't exist
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cid TEXT,
        type TEXT NOT NULL,
        source TEXT NOT NULL,
        title TEXT,
        text TEXT,
        link TEXT,
        topics TEXT,
        date INTEGER,
        metadata TEXT  -- JSON-encoded metadata
      );
    `);

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS summary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        title TEXT,
        categories TEXT,
        date INTEGER
      );
    `);
  }


  public async close(): Promise<void> {
    if (this.db) {
      await this.db.close()
    }
  }

  public async saveContentItems(items: ContentItem[]): Promise<ContentItem[]> {
    if (!this.db) {
      throw new Error("Database not initialized. Call init() first.");
    }

    // Prepare an UPDATE statement for the metadata
    const updateStmt = await this.db.prepare(`
      UPDATE items
      SET metadata = ?
      WHERE cid = ?
    `);

    // Prepare an INSERT statement for new rows
    const insertStmt = await this.db.prepare(`
      INSERT INTO items (type, source, cid, title, text, link, topics, date, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      await this.db.run("BEGIN TRANSACTION");

      for (const item of items) {
        if (!item) {
          continue
        }
        if (!item.cid) {
          const result = await insertStmt.run(
            item.type,
            item.source,
            null,
            item.title,
            item.text,
            item.link,
            item.topics ? JSON.stringify(item.topics) : null,
            item.date,
            item.metadata ? JSON.stringify(item.metadata) : null
          );
          item.id = result.lastID || undefined;
          continue;
        }

        const existingRow = await this.db.get<{ id: number }>(
          `SELECT id FROM items WHERE cid = ?`,
          [item.cid]
        );

        if (existingRow) {
          await updateStmt.run(
            item.metadata ? JSON.stringify(item.metadata) : null,
            item.cid
          );
          item.id = existingRow.id;
        } else {
          const metadataStr = item.metadata ? JSON.stringify(item.metadata) : null;
          const topicStr = item.topics ? JSON.stringify(item.topics) : null;

          const result = await insertStmt.run(
            item.type,
            item.source,
            item.cid,
            item.title,
            item.text,
            item.link,
            topicStr,
            item.date,
            metadataStr
          );
          item.id = result.lastID || undefined;
        }
      }

      await this.db.run("COMMIT");
    } catch (error) {
      await this.db.run("ROLLBACK");
      throw error;
    } finally {
      await updateStmt.finalize();
      await insertStmt.finalize();
    }

    return items;
  }

  public async getContentItem(cid: string): Promise<ContentItem | null> {
    if (!this.db) {
      throw new Error("Database not initialized. Call init() first.");
    }
  
    const row = await this.db.get(`SELECT * FROM items WHERE cid = ?`, [cid]);
  
    if (!row) {
      return null;
    }
  
    const item: ContentItem = {
      id: row.id,
      type: row.type,
      source: row.source,
      cid: row.cid,
      title: row.title,
      text: row.text,
      link: row.link,
      topics: row.topics ? JSON.parse(row.topics) : null,
      date: row.date,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    };
  
    return item;
  }

  public async saveSummaryItem(item: SummaryItem): Promise<void> {
    if (!this.db) {
      throw new Error("Database not initialized. Call init() first.");
    }

    await this.db.run(
      `
      INSERT INTO summary (type, title, categories, date)
      VALUES (?, ?, ?, ?)
      `,
      [
        item.type,
        item.title || null,
        item.categories || null,
        item.date,
      ]
    );
  }

  public async getItemsByType(type: string): Promise<ContentItem[]> {
    if (!this.db) {
      throw new Error("Database not initialized.");
    }

    const rows = await this.db.all(`
      SELECT * FROM items WHERE type = ?
    `, [type]);

    return rows.map(row => ({
      id: row.id,
      cid: row.cid,
      type: row.type,
      source: row.source,
      title: row.title,
      text: row.text,
      link: row.link,
      topics: row.topics ? JSON.parse(row.topics) : undefined,
      date: row.date,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  public async getContentItemsBetweenEpoch(
    startEpoch: number,
    endEpoch: number,
    excludeType?: string
  ): Promise<ContentItem[]> {
    if (!this.db) {
      throw new Error("Database not initialized.");
    }

    if (startEpoch > endEpoch) {
      throw new Error("startEpoch must be less than or equal to endEpoch.");
    }

    let query = `SELECT * FROM items WHERE date BETWEEN ? AND ?`;
    const params: any[] = [startEpoch - 1, endEpoch + 1];

    if (excludeType) {
      query += ` AND type != ?`;
      params.push(excludeType);
    }

    try {
      const rows = await this.db.all(query, params);

      return rows.map(row => ({
        id: row.id,
        type: row.type,
        source: row.source,
        cid: row.cid,
        title: row.title || undefined,
        text: row.text || undefined,
        link: row.link || undefined,
        date: row.date,
        topics: row.topics ? JSON.parse(row.topics) : undefined,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));
    } catch (error) {
      console.error("Error fetching content items between epochs:", error);
      throw error;
    }
  }
  
  public async getSummaryBetweenEpoch(
    startEpoch: number,
    endEpoch: number,
    excludeType?: string
  ): Promise<SummaryItem[]> {
    if (!this.db) {
      throw new Error("Database not initialized.");
    }

    if (startEpoch > endEpoch) {
      throw new Error("startEpoch must be less than or equal to endEpoch.");
    }

    let query = `SELECT * FROM summary WHERE date BETWEEN ? AND ?`;
    const params: any[] = [startEpoch, endEpoch];
    
    if (excludeType) {
      query += ` AND type != ?`;
      params.push(excludeType);
    }

    try {
      const rows = await this.db.all(query, params);

      return rows.map(row => ({
        id: row.id,
        type: row.type,
        title: row.title || undefined,
        categories: row.categories || undefined,
        date: row.date,
      }));
    } catch (error) {
      console.error("Error fetching summary between epochs:", error);
      throw error;
    }
  }
}
