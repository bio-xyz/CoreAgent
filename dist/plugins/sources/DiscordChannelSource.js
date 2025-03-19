"use strict";
// src/plugins/sources/DiscordSource.ts
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscordChannelSource = void 0;
const discord_js_1 = require("discord.js");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class DiscordChannelSource {
    constructor(config) {
        this.botToken = '';
        this.name = config.name;
        this.provider = config.provider;
        this.botToken = config.botToken;
        this.channelIds = config.channelIds;
        this.client = new discord_js_1.Client({
            intents: [discord_js_1.GatewayIntentBits.Guilds, discord_js_1.GatewayIntentBits.GuildMessages, discord_js_1.GatewayIntentBits.MessageContent]
        });
        this.stateFilePath = path.resolve(__dirname, '../../../data/lastProcessed.json');
        this.lastProcessed = this.loadState();
    }
    async fetchItems() {
        if (!this.client.isReady()) {
            await this.client.login(this.botToken);
        }
        let discordResponse = [];
        for (const channelId of this.channelIds) {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel || channel.type !== discord_js_1.ChannelType.GuildText) {
                console.warn(`Channel ID ${channelId} is not a text channel or does not exist.`);
                continue;
            }
            const textChannel = channel;
            const fetchOptions = { limit: 100 };
            const lastProcessedId = this.lastProcessed[channelId];
            if (lastProcessedId) {
                fetchOptions.after = lastProcessedId;
            }
            // Fetch the latest 100 messages to create a meaningful summary
            const messages = await textChannel.messages.fetch(fetchOptions);
            if (messages.size === 0) {
                console.log(`No new messages found for channel ${channelId}.`);
                continue;
            }
            const sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
            let transcript = '';
            sortedMessages.forEach((msg) => {
                transcript += `[${msg.author.username}]: ${msg.content}\n`;
            });
            const prompt = this.formatStructuredPrompt(transcript);
            if (this.provider) {
                const summary = await this.provider.summarize(prompt);
                discordResponse.push({
                    type: "discordChannelSummary",
                    cid: `${channelId}-${lastProcessedId}`,
                    source: this.name,
                    text: summary,
                    link: `https://discord.com/channels/${channel.guild.id}/${channelId}`,
                    date: Math.floor(new Date().getTime() / 1000),
                    metadata: {
                        channelId: channelId,
                        guildId: channel.guild.id,
                        summaryDate: Math.floor(new Date().getTime() / 1000),
                    },
                });
                const lastMessage = sortedMessages.first();
                if (lastMessage) {
                    this.lastProcessed[channelId] = lastMessage.id;
                    this.saveState();
                }
            }
        }
        return discordResponse;
    }
    async fetchHistorical(date) {
        if (!this.client.isReady()) {
            await this.client.login(this.botToken);
        }
        const cutoffTimestamp = new Date(date).getTime();
        let discordResponse = [];
        for (const channelId of this.channelIds) {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel || channel.type !== discord_js_1.ChannelType.GuildText) {
                console.warn(`Channel ID ${channelId} is not a text channel or does not exist.`);
                continue;
            }
            const textChannel = channel;
            let allMessages = [];
            let lastMessageId = undefined;
            // Paginate backwards until messages are older than the cutoff date.
            while (true) {
                const fetchOptions = { limit: 100 };
                if (lastMessageId) {
                    fetchOptions.before = lastMessageId;
                }
                const messages = await textChannel.messages.fetch(fetchOptions);
                if (messages.size === 0)
                    break;
                // Filter the batch for messages on/after the cutoff timestamp.
                messages.forEach((msg) => {
                    if (msg.createdTimestamp >= cutoffTimestamp) {
                        allMessages.push(msg);
                    }
                });
                // If the oldest message in this batch is older than the cutoff, stop fetching.
                const oldestMessage = messages.last();
                if (!oldestMessage || oldestMessage.createdTimestamp < cutoffTimestamp) {
                    break;
                }
                lastMessageId = oldestMessage.id;
            }
            if (allMessages.length === 0) {
                console.log(`No messages found for channel ${channelId} since ${date}.`);
                continue;
            }
            // Sort messages in ascending order so the transcript is chronological.
            allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
            let transcript = '';
            allMessages.forEach((msg) => {
                transcript += `[${msg.author.username}]: ${msg.content}\n`;
            });
            const prompt = this.formatStructuredPrompt(transcript);
            if (this.provider) {
                const summary = await this.provider.summarize(prompt);
                discordResponse.push({
                    type: "discordChannelHistoricalSummary",
                    cid: `${channelId}-historical-${date}`,
                    source: this.name,
                    text: summary,
                    link: `https://discord.com/channels/${textChannel.guild.id}/${channelId}`,
                    date: Math.floor(cutoffTimestamp / 1000),
                    metadata: {
                        channelId: channelId,
                        guildId: textChannel.guild.id,
                        summaryDate: Math.floor(cutoffTimestamp / 1000),
                        historicalSince: date,
                    },
                });
            }
        }
        return discordResponse;
    }
    // Load the last processed message IDs from the JSON file
    loadState() {
        try {
            if (fs.existsSync(this.stateFilePath)) {
                const data = fs.readFileSync(this.stateFilePath, 'utf-8');
                return JSON.parse(data);
            }
            else {
                return {};
            }
        }
        catch (error) {
            console.error('Error loading state file:', error);
            return {};
        }
    }
    // Save the last processed message IDs to the JSON file
    saveState() {
        try {
            fs.writeFileSync(this.stateFilePath, JSON.stringify(this.lastProcessed, null, 2), 'utf-8');
        }
        catch (error) {
            console.error('Error saving state file:', error);
        }
    }
    formatStructuredPrompt(transcript) {
        return `Analyze this Discord chat segment and provide a succinct analysis:
            
1. Summary (max 500 words):
- Focus ONLY on the most important technical discussions, decisions, and problem-solving
- Highlight concrete solutions and implementations
- Be specific and VERY concise

2. FAQ (max 20 questions):
- Only include the most significant questions that got meaningful responses
- Focus on unique questions, skip similar or rhetorical questions
- Include who asked the question and who answered
- Use the exact Discord username from the chat

3. Help Interactions (max 10):
- List the significant instances where community members helped each other.
- Be specific and concise about what kind of help was given
- Include context about the problem that was solved
- Mention if the help was successful

4. Action Items (max 20 total):
- Technical Tasks: Critical development tasks only
- Documentation Needs: Essential doc updates only
- Feature Requests: Major feature suggestions only

For each action item, include:
- Clear description
- Who mentioned it

Chat transcript:
${transcript}

Return the analysis in the specified structured format. Be specific about technical content and avoid duplicating information.`;
    }
}
exports.DiscordChannelSource = DiscordChannelSource;
