"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveParam = exports.loadStorage = exports.loadProviders = exports.loadItems = exports.loadDirectoryModules = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const loadDirectoryModules = async (directory) => {
    const classes = {};
    const dir = path_1.default.join(__dirname, "../", "plugins", directory);
    const files = fs_1.default.readdirSync(dir).filter(file => file.endsWith(".ts"));
    for (const file of files) {
        const modulePath = path_1.default.join(dir, file);
        const moduleExports = await Promise.resolve(`${modulePath}`).then(s => __importStar(require(s)));
        const className = file.replace(".ts", "");
        classes[className] = moduleExports.default || moduleExports[className];
    }
    return classes;
};
exports.loadDirectoryModules = loadDirectoryModules;
const loadItems = async (items, mapping, category) => {
    return items.map((item) => {
        const { type, name, params, interval } = item;
        const ClassRef = mapping[type];
        if (!ClassRef) {
            throw new Error(`Unknown ${category} type: ${type}`);
        }
        const resolvedParams = Object.entries(params).reduce((acc, [key, value]) => {
            acc[key] = typeof value === "string" ? (0, exports.resolveParam)(value) : value;
            return acc;
        }, {});
        const instance = new ClassRef({ name, ...resolvedParams });
        return interval !== undefined ? { instance, interval } : { instance };
    });
};
exports.loadItems = loadItems;
const loadProviders = async (instances, providers) => {
    instances.forEach(({ instance }) => {
        if ("provider" in instance && instance.provider) {
            const chosenProvider = providers.find((provider) => {
                return provider.instance.name === instance.provider;
            });
            if (!chosenProvider) {
                throw (`Error: Invalid Provider Name ${instance.provider}`);
            }
            else {
                instance.provider = chosenProvider.instance;
            }
        }
    });
    return instances;
};
exports.loadProviders = loadProviders;
const loadStorage = async (instances, storages) => {
    instances.forEach(({ instance }) => {
        if ("storage" in instance && instance.storage) {
            const chosenStorage = storages.find((storage) => {
                return storage.instance.name === instance.storage;
            });
            if (!chosenStorage) {
                throw (`Error: Invalid Storage Name ${instance.storage}`);
            }
            else {
                instance.storage = chosenStorage.instance;
            }
        }
    });
    return instances;
};
exports.loadStorage = loadStorage;
const resolveParam = (value) => {
    if (value.startsWith("process.env.")) {
        const envVar = value.replace("process.env.", "");
        return process.env[envVar] || "";
    }
    return value;
};
exports.resolveParam = resolveParam;
