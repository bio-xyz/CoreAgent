"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ContentAggregator_1 = require("./aggregator/ContentAggregator");
const configHelper_1 = require("./helpers/configHelper");
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
(async () => {
    try {
        // Fetch override args to get run specific source config
        const args = process.argv.slice(2);
        let sourceFile = "sources.json";
        let runOnce = false;
        let onlyFetch = false;
        let outputPath = './'; // Default output path
        args.forEach(arg => {
            if (arg.startsWith('--source=')) {
                sourceFile = arg.split('=')[1];
            }
            if (arg.startsWith('--onlyFetch=')) {
                onlyFetch = arg.split('=')[1].toLowerCase() == 'true';
            }
            if (arg.startsWith('--output=') || arg.startsWith('-o=')) {
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
        if (typeof configJSON?.settings?.runOnce === 'boolean') {
            runOnce = configJSON?.settings?.runOnce || runOnce;
        }
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
        const aggregator = new ContentAggregator_1.ContentAggregator();
        // Register Sources under Aggregator
        sourceConfigs.forEach((config) => aggregator.registerSource(config.instance));
        // Register Enrichers under Aggregator
        enricherConfigs.forEach((config) => aggregator.registerEnricher(config.instance));
        // Initialize and Register Storage, Should just be one Storage Plugin for now.
        storageConfigs.forEach(async (storage) => {
            await storage.instance.init();
            aggregator.registerStorage(storage.instance);
        });
        //Fetch Sources
        for (const config of sourceConfigs) {
            await aggregator.fetchAndStore(config.instance.name);
            setInterval(() => {
                aggregator.fetchAndStore(config.instance.name);
            }, config.interval);
        }
        if (!onlyFetch) {
            //Generate Content
            for (const generator of generatorConfigs) {
                await generator.instance.generateContent();
                setInterval(() => {
                    generator.instance.generateContent();
                }, generator.interval);
            }
        }
        else {
            console.log("Summary will not be generated.");
        }
        console.log("Content aggregator is running and scheduled.");
        const shutdown = async () => {
            console.log("Shutting down...");
            storageConfigs.forEach(async (storage) => {
                await storage.close();
            });
            process.exit(0);
        };
        process.on("SIGINT", shutdown);
        process.on("SIGTERM", shutdown);
        if (runOnce) {
            await shutdown();
            console.log("Content aggregator is complete.");
        }
    }
    catch (error) {
        console.error("Error initializing the content aggregator:", error);
        process.exit(1);
    }
})();
