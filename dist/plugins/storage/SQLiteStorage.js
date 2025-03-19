"use strict";
// src/plugins/storage/UnifiedStorage.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteStorage = void 0;
const sqlite_1 = require("sqlite");
const sqlite3_1 = __importDefault(require("sqlite3"));
class SQLiteStorage {
    constructor(config) {
        this.db = null;
        this.name = config.name;
        this.dbPath = config.dbPath;
    }
    async init() {
        this.db = await (0, sqlite_1.open)({ filename: this.dbPath, driver: sqlite3_1.default.Database });
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
    async close() {
        if (this.db) {
            await this.db.close();
        }
    }
    async saveContentItems(items) {
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
                    continue;
                }
                if (!item.cid) {
                    const result = await insertStmt.run(item.type, item.source, null, item.title, item.text, item.link, item.topics ? JSON.stringify(item.topics) : null, item.date, item.metadata ? JSON.stringify(item.metadata) : null);
                    item.id = result.lastID || undefined;
                    continue;
                }
                const existingRow = await this.db.get(`SELECT id FROM items WHERE cid = ?`, [item.cid]);
                if (existingRow) {
                    await updateStmt.run(item.metadata ? JSON.stringify(item.metadata) : null, item.cid);
                    item.id = existingRow.id;
                }
                else {
                    const metadataStr = item.metadata ? JSON.stringify(item.metadata) : null;
                    const topicStr = item.topics ? JSON.stringify(item.topics) : null;
                    const result = await insertStmt.run(item.type, item.source, item.cid, item.title, item.text, item.link, topicStr, item.date, metadataStr);
                    item.id = result.lastID || undefined;
                }
            }
            await this.db.run("COMMIT");
        }
        catch (error) {
            await this.db.run("ROLLBACK");
            throw error;
        }
        finally {
            await updateStmt.finalize();
            await insertStmt.finalize();
        }
        return items;
    }
    async getContentItem(cid) {
        if (!this.db) {
            throw new Error("Database not initialized. Call init() first.");
        }
        const row = await this.db.get(`SELECT * FROM items WHERE cid = ?`, [cid]);
        if (!row) {
            return null;
        }
        const item = {
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
    async saveSummaryItem(item) {
        if (!this.db) {
            throw new Error("Database not initialized. Call init() first.");
        }
        await this.db.run(`
      INSERT INTO summary (type, title, categories, date)
      VALUES (?, ?, ?, ?)
      `, [
            item.type,
            item.title || null,
            item.categories || null,
            item.date,
        ]);
    }
    async getItemsByType(type) {
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
    async getContentItemsBetweenEpoch(startEpoch, endEpoch, excludeType) {
        if (!this.db) {
            throw new Error("Database not initialized.");
        }
        if (startEpoch > endEpoch) {
            throw new Error("startEpoch must be less than or equal to endEpoch.");
        }
        let query = `SELECT * FROM items WHERE date BETWEEN ? AND ?`;
        const params = [startEpoch - 1, endEpoch + 1];
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
        }
        catch (error) {
            console.error("Error fetching content items between epochs:", error);
            throw error;
        }
    }
    async getSummaryBetweenEpoch(startEpoch, endEpoch, excludeType) {
        if (!this.db) {
            throw new Error("Database not initialized.");
        }
        if (startEpoch > endEpoch) {
            throw new Error("startEpoch must be less than or equal to endEpoch.");
        }
        let query = `SELECT * FROM summary WHERE date BETWEEN ? AND ?`;
        const params = [startEpoch, endEpoch];
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
        }
        catch (error) {
            console.error("Error fetching summary between epochs:", error);
            throw error;
        }
    }
}
exports.SQLiteStorage = SQLiteStorage;
