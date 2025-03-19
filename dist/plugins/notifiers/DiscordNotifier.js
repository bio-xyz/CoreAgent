"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscordNotifier = void 0;
const discord_js_1 = require("discord.js");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class DiscordNotifier {
    constructor(config) {
        this.name = config.name;
        this.botToken = config.botToken;
        this.channelIds = config.channelIds;
        this.outputPath = config.outputPath || './output';
        this.client = new discord_js_1.Client({
            intents: [discord_js_1.GatewayIntentBits.Guilds, discord_js_1.GatewayIntentBits.GuildMessages, discord_js_1.GatewayIntentBits.MessageContent]
        });
    }
    async init() {
        if (!this.client.isReady()) {
            try {
                await this.client.login(this.botToken);
                console.log(`DiscordNotifier initialized with ${this.channelIds.length} channels`);
            }
            catch (error) {
                console.error('Error logging in to Discord:', error);
            }
        }
    }
    async sendSummary(dateStr, sourceLinksByTopic) {
        try {
            if (!this.client.isReady()) {
                await this.init();
            }
            // Check if summary exists for the given date
            const mdFilePath = path_1.default.join(this.outputPath, 'md', `${dateStr}.md`);
            const jsonFilePath = path_1.default.join(this.outputPath, 'json', `${dateStr}.json`);
            if (!fs_1.default.existsSync(mdFilePath)) {
                console.log(`No summary found for date ${dateStr}`);
                return;
            }
            // Read the summary file
            const summaryContent = fs_1.default.readFileSync(mdFilePath, 'utf-8');
            // Load the JSON data to get structured info (if available)
            let jsonData = null;
            if (fs_1.default.existsSync(jsonFilePath)) {
                try {
                    jsonData = JSON.parse(fs_1.default.readFileSync(jsonFilePath, 'utf-8'));
                    console.log('JSON data loaded successfully. Categories count:', jsonData?.categories?.length || 0);
                    // Debug: log source links
                    if (sourceLinksByTopic) {
                        console.log('Source links available for topics:', Object.keys(sourceLinksByTopic));
                        Object.entries(sourceLinksByTopic).forEach(([topic, links]) => {
                            console.log(`Topic "${topic}" has ${links.length} links`);
                        });
                    }
                    else {
                        console.log('No source links provided');
                    }
                }
                catch (e) {
                    console.log('Error parsing JSON file, continuing with markdown only:', e);
                }
            }
            // Parse the markdown to identify section headers (topics)
            const sections = this.parseMarkdownSections(summaryContent);
            console.log(`Found ${sections.length} sections in the markdown content`);
            // Send to all configured channels
            for (const channelId of this.channelIds) {
                try {
                    const channel = await this.client.channels.fetch(channelId);
                    if (!channel || !channel.isTextBased()) {
                        console.warn(`Channel ID ${channelId} is not a text channel or does not exist.`);
                        continue;
                    }
                    const textChannel = channel;
                    // Send initial message
                    await textChannel.send(`**Daily Summary for ${dateStr}**`);
                    // Process each section, adding inline citations
                    for (const section of sections) {
                        const { topic, content } = section;
                        console.log(`Processing section "${topic}" with ${content.split('\n').length} lines`);
                        // Get source links for this topic
                        const links = sourceLinksByTopic?.[topic] || [];
                        console.log(`Topic "${topic}" has ${links.length} source links`);
                        // Add inline citations to the content
                        const contentWithCitations = this.addInlineCitations(content, links);
                        // Send the section content with citations
                        const contentChunks = this.chunkMessage(contentWithCitations, 1900);
                        for (const chunk of contentChunks) {
                            await textChannel.send(chunk);
                        }
                    }
                    console.log(`Summary for ${dateStr} sent to channel ${channelId}`);
                }
                catch (error) {
                    console.error(`Error sending message to channel ${channelId}:`, error);
                }
            }
        }
        catch (error) {
            console.error(`Error in sendSummary for ${dateStr}:`, error);
        }
    }
    // Add inline citations to content
    addInlineCitations(content, sourceLinks) {
        if (sourceLinks.length === 0) {
            console.log('No source links to add citations');
            return content;
        }
        // Process bullet points and add citations
        const lines = content.split('\n');
        const processedLines = [];
        let citationIndex = 0;
        for (const line of lines) {
            // Check if this is a bullet point line
            if (line.match(/^\s*[\*\-\+]\s+/)) {
                if (citationIndex < sourceLinks.length) {
                    const link = sourceLinks[citationIndex];
                    // Add citation at the end of the bullet point, with stars around the link
                    processedLines.push(`${line} *${link}*`);
                    citationIndex++;
                }
                else {
                    processedLines.push(line);
                }
            }
            else {
                processedLines.push(line);
            }
        }
        console.log(`Added ${citationIndex} citations to content`);
        return processedLines.join('\n');
    }
    // Parse markdown into sections by heading
    parseMarkdownSections(markdown) {
        const sections = [];
        // Split by heading markers (##, ###, etc)
        const lines = markdown.split('\n');
        let currentTopic = 'General';
        let currentContent = '';
        for (const line of lines) {
            if (line.match(/^#+\s+.+/)) {
                // If we already have content, save the previous section
                if (currentContent.trim()) {
                    sections.push({
                        topic: currentTopic,
                        content: currentContent.trim()
                    });
                }
                // Start a new section
                currentTopic = line.replace(/^#+\s+/, '').trim();
                currentContent = line + '\n';
            }
            else {
                // Add to current section
                currentContent += line + '\n';
            }
        }
        // Add the last section
        if (currentContent.trim()) {
            sections.push({
                topic: currentTopic,
                content: currentContent.trim()
            });
        }
        return sections;
    }
    // Helper to split long messages into Discord-compatible chunks
    chunkMessage(text, maxLength) {
        const chunks = [];
        let currentChunk = '';
        const lines = text.split('\n');
        for (const line of lines) {
            if (currentChunk.length + line.length + 1 > maxLength) {
                chunks.push(currentChunk);
                currentChunk = line;
            }
            else {
                currentChunk += (currentChunk ? '\n' : '') + line;
            }
        }
        if (currentChunk) {
            chunks.push(currentChunk);
        }
        return chunks;
    }
    async close() {
        if (this.client.isReady()) {
            this.client.destroy();
        }
    }
}
exports.DiscordNotifier = DiscordNotifier;
