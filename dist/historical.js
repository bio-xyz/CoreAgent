"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const HistoricalAggregator_1 = require("./aggregator/HistoricalAggregator");
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const configHelper_1 = require("./helpers/configHelper");
const dateHelper_1 = require("./helpers/dateHelper");
dotenv_1.default.config();
(async () => {
    try {
        // Fetch override args to get run specific source config
        const args = process.argv.slice(2);
        const today = new Date();
        let sourceFile = "sources.json";
        let dateStr = today.toISOString().slice(0, 10);
        let onlyFetch = false;
        let beforeDate;
        let afterDate;
        let duringDate;
        let outputPath = './'; // Default output path
        args.forEach(arg => {
            if (arg.startsWith('--source=')) {
                sourceFile = arg.split('=')[1];
            }
            else if (arg.startsWith('--date=')) {
                dateStr = arg.split('=')[1];
            }
            else if (arg.startsWith('--onlyFetch=')) {
                onlyFetch = arg.split('=')[1].toLowerCase() == 'true';
            }
            else if (arg.startsWith('--before=')) {
                beforeDate = arg.split('=')[1];
            }
            else if (arg.startsWith('--after=')) {
                afterDate = arg.split('=')[1];
            }
            else if (arg.startsWith('--during=')) {
                duringDate = arg.split('=')[1];
            }
            else if (arg.startsWith('--output=') || arg.startsWith('-o=')) {
                outputPath = arg.split('=')[1];
            }
        });
        const sourceClasses = await (0, configHelper_1.loadDirectoryModules)("sources");
        const aiClasses = await (0, configHelper_1.loadDirectoryModules)("ai");
        const enricherClasses = await (0, configHelper_1.loadDirectoryModules)("enrichers");
        const generatorClasses = await (0, configHelper_1.loadDirectoryModules)("generators");
        const storageClasses = await (0, configHelper_1.loadDirectoryModules)("storage");
        // Load the JSON configuration file
        const configPath = path_1.default.join(__dirname, "../config", sourceFile);
        const configFile = fs_1.default.readFileSync(configPath, "utf8");
        const configJSON = JSON.parse(configFile);
        if (typeof configJSON?.settings?.onlyFetch === 'boolean') {
            onlyFetch = configJSON?.settings?.onlyFetch || onlyFetch;
        }
        let aiConfigs = await (0, configHelper_1.loadItems)(configJSON.ai, aiClasses, "ai");
        let sourceConfigs = await (0, configHelper_1.loadItems)(configJSON.sources, sourceClasses, "source");
        let enricherConfigs = await (0, configHelper_1.loadItems)(configJSON.enrichers, enricherClasses, "enrichers");
        let generatorConfigs = await (0, configHelper_1.loadItems)(configJSON.generators, generatorClasses, "generators");
        let storageConfigs = await (0, configHelper_1.loadItems)(configJSON.storage, storageClasses, "storage");
        // If any configs depends on the AI provider, set it here
        sourceConfigs = await (0, configHelper_1.loadProviders)(sourceConfigs, aiConfigs);
        enricherConfigs = await (0, configHelper_1.loadProviders)(enricherConfigs, aiConfigs);
        generatorConfigs = await (0, configHelper_1.loadProviders)(generatorConfigs, aiConfigs);
        // If any configs depends on the storage, set it here
        generatorConfigs = await (0, configHelper_1.loadStorage)(generatorConfigs, storageConfigs);
        // Set output path for generators
        generatorConfigs.forEach(config => {
            if (config.instance && typeof config.instance.outputPath === 'undefined') {
                config.instance.outputPath = outputPath;
            }
        });
        const aggregator = new HistoricalAggregator_1.HistoricalAggregator();
        // Register Sources under Aggregator
        sourceConfigs.forEach((config) => {
            if (config.instance?.fetchHistorical) {
                aggregator.registerSource(config.instance);
            }
        });
        // Register Enrichers under Aggregator
        enricherConfigs.forEach((config) => aggregator.registerEnricher(config.instance));
        // Initialize and Register Storage, Should just be one Storage Plugin for now.
        storageConfigs.forEach(async (storage) => {
            await storage.instance.init();
            aggregator.registerStorage(storage.instance);
        });
        let filter = {};
        if (beforeDate || afterDate || duringDate) {
            if (beforeDate && afterDate) {
                filter = { after: afterDate, before: beforeDate };
            }
            else if (duringDate) {
                filter = { filterType: 'during', date: duringDate };
            }
            else if (beforeDate) {
                filter = { filterType: 'before', date: beforeDate };
            }
            else if (afterDate) {
                filter = { filterType: 'after', date: afterDate };
            }
        }
        if (filter.filterType || (filter.after && filter.before)) {
            for (const config of sourceConfigs) {
                await aggregator.fetchAndStoreRange(config.instance.name, filter);
            }
        }
        else {
            for (const config of sourceConfigs) {
                await aggregator.fetchAndStore(config.instance.name, dateStr);
            }
        }
        console.log("Content aggregator is finished fetching historical.");
        if (!onlyFetch) {
            if (filter.filterType || (filter.after && filter.before)) {
                for (const generator of generatorConfigs) {
                    await generator.instance.storage.init();
                    await (0, dateHelper_1.callbackDateRangeLogic)(filter, (dateStr) => generator.instance.generateAndStoreSummary(dateStr));
                }
            }
            else {
                console.log(`Creating summary for date ${dateStr}`);
                for (const generator of generatorConfigs) {
                    await generator.instance.storage.init();
                    await generator.instance.generateAndStoreSummary(dateStr);
                }
            }
        }
        else {
            console.log("Historical Data successfully saved. Summary wasn't generated");
        }
        console.log("Shutting down...");
        storageConfigs.forEach(async (storage) => {
            await storage.close();
        });
        process.exit(0);
    }
    catch (error) {
        console.error("Error initializing the content aggregator:", error);
        process.exit(1);
    }
})();
