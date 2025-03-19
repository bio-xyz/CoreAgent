"use strict";
// cache.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwitterCache = exports.Cache = void 0;
class Cache {
    constructor() {
        this.store = {};
    }
    /**
     * Sets a value in the cache.
     * @param key The cache key.
     * @param value The value to cache.
     * @param ttlSeconds Optional time-to-live in seconds.
     */
    set(key, value, ttlSeconds) {
        let expiresAt = null;
        if (ttlSeconds) {
            expiresAt = Date.now() + ttlSeconds * 1000;
        }
        this.store[key] = { value, expiresAt };
    }
    /**
     * Gets a value from the cache.
     * @param key The cache key.
     * @returns The cached value or undefined if not found or expired.
     */
    get(key) {
        const entry = this.store[key];
        if (!entry) {
            return undefined;
        }
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            // The entry has expired.
            delete this.store[key];
            return undefined;
        }
        return entry.value;
    }
    /**
     * Deletes a value from the cache.
     * @param key The cache key.
     */
    del(key) {
        delete this.store[key];
    }
    /**
     * Clears the entire cache.
     */
    clear() {
        this.store = {};
    }
}
exports.Cache = Cache;
class TwitterCache {
    constructor() {
        this.cache = new Cache();
    }
    getCacheKey(account, date) {
        return `twitter:${account}:${date}`;
    }
    getCursorKey(account) {
        return `twitter:${account}:cursor`;
    }
    set(account, date, data, ttlSeconds) {
        const key = this.getCacheKey(account, date);
        this.cache.set(key, data, ttlSeconds);
    }
    get(account, date) {
        const key = this.getCacheKey(account, date);
        return this.cache.get(key);
    }
    setCursor(account, cursor) {
        const key = this.getCursorKey(account);
        this.cache.set(key, cursor, 300);
    }
    getCursor(account) {
        const key = this.getCursorKey(account);
        return this.cache.get(key);
    }
    clear() {
        this.cache.clear();
    }
}
exports.TwitterCache = TwitterCache;
