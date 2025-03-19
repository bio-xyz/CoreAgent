"use strict";
// src/plugins/generators/DailySummaryGenerator.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailySummaryGenerator = void 0;
const promptHelper_1 = require("../../helpers/promptHelper");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DiscordNotifier_1 = require("../notifiers/DiscordNotifier");
const hour = 60 * 60 * 1000;
class DailySummaryGenerator {
    constructor(config) {
        this.blockedTopics = ['open source'];
        this.provider = config.provider;
        this.storage = config.storage;
        this.summaryType = config.summaryType;
        this.source = config.source;
        this.outputPath = config.outputPath || './'; // Default to current directory if not specified
        // Initialize Discord notifier if channel IDs are provided
        if (config.discordChannelIds && config.discordChannelIds.length > 0 && config.discordToken) {
            this.discordNotifier = new DiscordNotifier_1.DiscordNotifier({
                name: 'summaryNotifier',
                botToken: config.discordToken,
                channelIds: config.discordChannelIds,
                outputPath: this.outputPath
            });
        }
    }
    async generateAndStoreSummary(dateStr) {
        try {
            const currentTime = new Date(dateStr).getTime() / 1000;
            const targetTime = currentTime + (60 * 60 * 24);
            const contentItems = await this.storage.getContentItemsBetweenEpoch(currentTime, targetTime, this.summaryType);
            if (contentItems.length === 0) {
                console.warn(`No content found for date ${dateStr} to generate summary.`);
                return;
            }
            const groupedContent = this.groupObjectsByTopics(contentItems);
            const allSummaries = [];
            const sourceLinksByTopic = {}; // Store source links by topic
            let maxTopicsToSummarize = 0;
            for (const grouped of groupedContent) {
                try {
                    if (!grouped)
                        continue;
                    const { topic, objects } = grouped;
                    if (!topic || !objects || objects.length <= 0 || maxTopicsToSummarize >= 10)
                        continue;
                    // Extract and store source links for this topic
                    const sourceLinks = objects
                        .filter((obj) => obj.link !== undefined)
                        .map((obj) => obj.link);
                    sourceLinksByTopic[topic] = Array.from(new Set(sourceLinks)); // Remove duplicates
                    const prompt = (0, promptHelper_1.createJSONPromptForTopics)(topic, objects, dateStr);
                    const summaryText = await this.provider.summarize(prompt);
                    const summaryJSONString = summaryText.replace(/```json\n|```/g, "");
                    let summaryJSON = JSON.parse(summaryJSONString);
                    summaryJSON["topic"] = topic;
                    // Add source links to the JSON summary
                    summaryJSON["sourceLinks"] = sourceLinksByTopic[topic];
                    allSummaries.push(summaryJSON);
                    maxTopicsToSummarize++;
                }
                catch (e) {
                    console.log(e);
                }
            }
            const mdPrompt = (0, promptHelper_1.createMarkdownPromptForJSON)(allSummaries, dateStr);
            const markdownReport = await this.provider.summarize(mdPrompt);
            const markdownString = markdownReport.replace(/```markdown\n|```/g, "");
            const summaryItem = {
                type: this.summaryType,
                title: `Daily Report - ${dateStr}`,
                categories: JSON.stringify(allSummaries, null, 2),
                markdown: markdownString,
                date: currentTime,
            };
            await this.storage.saveSummaryItem(summaryItem);
            await this.writeSummaryToFile(dateStr, currentTime, allSummaries);
            await this.writeMDToFile(dateStr, markdownString);
            console.log(`Daily report for ${dateStr} generated and stored successfully.`);
            // Notify Discord if configured
            if (this.discordNotifier) {
                try {
                    await this.discordNotifier.sendSummary(dateStr, sourceLinksByTopic);
                }
                catch (error) {
                    console.error(`Error sending summary to Discord: ${error}`);
                }
            }
        }
        catch (error) {
            console.error(`Error generating daily summary for ${dateStr}:`, error);
        }
    }
    async checkIfFileMatchesDB(dateStr, summary) {
        try {
            let jsonParsed = await this.readSummaryFromFile(dateStr);
            let summaryParsed = {
                type: summary.type,
                title: summary.title,
                categories: JSON.parse(summary.categories || "[]"),
                date: summary.date
            };
            if (!this.deepEqual(jsonParsed, summaryParsed)) {
                console.log("JSON file didn't match database, resaving summary to file.");
                await this.writeSummaryToFile(dateStr, summary.date || new Date().getTime(), summaryParsed.categories);
            }
        }
        catch (error) {
            console.error(`Error checkIfFileMatchesDB:`, error);
        }
    }
    async generateContent() {
        try {
            const today = new Date();
            let summary = await this.storage.getSummaryBetweenEpoch((today.getTime() - (hour * 24)) / 1000, today.getTime() / 1000);
            if (summary && summary.length <= 0) {
                const summaryDate = new Date(today);
                summaryDate.setDate(summaryDate.getDate() - 1);
                const dateStr = summaryDate.toISOString().slice(0, 10);
                console.log(`Summarizing data from for daily report`);
                await this.generateAndStoreSummary(dateStr);
                console.log(`Daily report is complete`);
            }
            else {
                console.log('Summary already generated for today, validating file is correct');
                const summaryDate = new Date(today);
                summaryDate.setDate(summaryDate.getDate() - 1);
                const dateStr = summaryDate.toISOString().slice(0, 10);
                await this.checkIfFileMatchesDB(dateStr, summary[0]);
            }
        }
        catch (error) {
            console.error(`Error creating daily report:`, error);
        }
    }
    deepEqual(obj1, obj2) {
        return JSON.stringify(obj1) === JSON.stringify(obj2);
    }
    async readSummaryFromFile(dateStr) {
        try {
            // Ensure directories exist
            const jsonDir = path_1.default.join(this.outputPath, 'json');
            this.ensureDirectoryExists(jsonDir);
            const filePath = path_1.default.join(jsonDir, `${dateStr}.json`);
            const data = fs_1.default.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
        catch (error) {
            console.error(`Error reading the file ${dateStr}:`, error);
        }
    }
    async writeSummaryToFile(dateStr, currentTime, allSummaries) {
        try {
            // Ensure directories exist
            const jsonDir = path_1.default.join(this.outputPath, 'json');
            this.ensureDirectoryExists(jsonDir);
            const filePath = path_1.default.join(jsonDir, `${dateStr}.json`);
            fs_1.default.writeFileSync(filePath, JSON.stringify({
                type: this.summaryType,
                title: `Daily Report - ${dateStr}`,
                categories: allSummaries,
                date: currentTime,
            }, null, 2));
        }
        catch (error) {
            console.error(`Error saving daily summary to json file ${dateStr}:`, error);
        }
    }
    async writeMDToFile(dateStr, content) {
        try {
            // Ensure directories exist
            const mdDir = path_1.default.join(this.outputPath, 'md');
            this.ensureDirectoryExists(mdDir);
            const filePath = path_1.default.join(mdDir, `${dateStr}.md`);
            fs_1.default.writeFileSync(filePath, content);
        }
        catch (error) {
            console.error(`Error saving daily summary to markdown file ${dateStr}:`, error);
        }
    }
    ensureDirectoryExists(dirPath) {
        if (!fs_1.default.existsSync(dirPath)) {
            fs_1.default.mkdirSync(dirPath, { recursive: true });
        }
    }
    groupObjectsByTopics(objects) {
        const topicMap = new Map();
        objects.forEach(obj => {
            if (obj.source.indexOf('github') >= 0) {
                let github_topic = obj.type === 'githubPullRequestContributor' ? 'pull_request' : obj.type === 'githubIssueContributor' ? 'issue' : 'commmit';
                if (!obj.topics) {
                    obj.topics = [];
                }
                if (!topicMap.has(github_topic)) {
                    topicMap.set(github_topic, []);
                }
                topicMap.get(github_topic).push(obj);
            }
            else if (obj.cid.indexOf('analytics') >= 0) {
                let token_topic = 'crypto market';
                if (!obj.topics) {
                    obj.topics = [];
                }
                if (!topicMap.has(token_topic)) {
                    topicMap.set(token_topic, []);
                }
                topicMap.get(token_topic).push(obj);
            }
            else {
                if (obj.topics) {
                    obj.topics.forEach((topic) => {
                        let shortCase = topic.toLowerCase();
                        if (!this.blockedTopics.includes(shortCase)) {
                            if (!topicMap.has(shortCase)) {
                                topicMap.set(shortCase, []);
                            }
                            topicMap.get(shortCase).push(obj);
                        }
                    });
                }
            }
        });
        const sortedTopics = Array.from(topicMap.entries()).sort((a, b) => b[1].length - a[1].length);
        const alreadyAdded = {};
        const miscTopics = {
            topic: 'Misceleanous',
            objects: [],
            allTopics: []
        };
        let groupedTopics = [];
        sortedTopics.forEach(([topic, associatedObjects]) => {
            const mergedTopics = new Set();
            let topicAlreadyAdded = false;
            associatedObjects.forEach((obj) => {
                obj.topics.forEach((t) => {
                    let lower = t.toLowerCase();
                    if (alreadyAdded[lower]) {
                        topicAlreadyAdded = true;
                    }
                    else {
                        mergedTopics.add(lower);
                    }
                });
            });
            if (associatedObjects && associatedObjects.length <= 1) {
                let objectIds = associatedObjects.map((object) => object.id);
                let alreadyAddedToMisc = miscTopics["objects"].find((object) => objectIds.indexOf(object.id) >= 0);
                if (!alreadyAddedToMisc) {
                    miscTopics["objects"] = miscTopics["objects"].concat(associatedObjects);
                    miscTopics["allTopics"] = miscTopics["allTopics"].concat(Array.from(mergedTopics));
                }
            }
            else if (!topicAlreadyAdded) {
                alreadyAdded[topic] = true;
                groupedTopics.push({
                    topic,
                    objects: associatedObjects,
                    allTopics: Array.from(mergedTopics)
                });
            }
        });
        groupedTopics.push(miscTopics);
        return groupedTopics;
    }
}
exports.DailySummaryGenerator = DailySummaryGenerator;
