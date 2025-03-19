"use strict";
// src/plugins/sources/DiscordSource.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscordAnnouncementSource = void 0;
const discord_js_1 = require("discord.js");
class DiscordAnnouncementSource {
    constructor(config) {
        this.botToken = '';
        this.name = config.name;
        this.botToken = config.botToken;
        this.channelIds = config.channelIds;
        this.client = new discord_js_1.Client({
            intents: [discord_js_1.GatewayIntentBits.Guilds, discord_js_1.GatewayIntentBits.GuildMessages, discord_js_1.GatewayIntentBits.MessageContent]
        });
    }
    async fetchItems() {
        if (!this.client.isReady()) {
            await this.client.login(this.botToken);
        }
        let discordResponse = [];
        for (const channelId of this.channelIds) {
            const channel = await this.client.channels.fetch(channelId);
            let out = [];
            if (!channel || channel.type !== 0) {
                continue;
            }
            const textChannel = channel;
            const messages = await textChannel.messages.fetch({ limit: 10 });
            messages.forEach((msg) => {
                discordResponse.push({
                    type: "discordMessage",
                    cid: msg.id,
                    source: this.name,
                    text: msg.content,
                    link: `https://discord.com/channels/${msg.guildId}/${msg.channelId}/${msg.id}`,
                    date: msg.createdTimestamp,
                    metadata: {
                        channelId: msg.channelId,
                        guildId: msg.guildId,
                        cid: msg.id,
                        author: msg.author.username,
                        messageId: msg.id
                    }
                });
            });
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
            if (!channel || channel.type !== 0) {
                continue;
            }
            const textChannel = channel;
            let lastMessageId = undefined;
            while (true) {
                const fetchOptions = { limit: 100 };
                if (lastMessageId) {
                    fetchOptions.before = lastMessageId;
                }
                const messages = await textChannel.messages.fetch(fetchOptions);
                if (messages.size === 0)
                    break;
                for (const msg of messages.values()) {
                    if (msg.createdTimestamp >= cutoffTimestamp) {
                        discordResponse.push({
                            type: "discordMessage",
                            cid: msg.id,
                            source: this.name,
                            text: msg.content,
                            link: `https://discord.com/channels/${msg.guildId}/${msg.channelId}/${msg.id}`,
                            date: msg.createdTimestamp,
                            metadata: {
                                channelId: msg.channelId,
                                guildId: msg.guildId,
                                cid: msg.id,
                                author: msg.author.username,
                                messageId: msg.id,
                            },
                        });
                    }
                }
                const oldestMessage = messages.last();
                if (!oldestMessage || oldestMessage.createdTimestamp < cutoffTimestamp) {
                    break;
                }
                lastMessageId = oldestMessage.id;
            }
        }
        return discordResponse;
    }
}
exports.DiscordAnnouncementSource = DiscordAnnouncementSource;
