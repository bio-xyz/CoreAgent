"use strict";
// src/plugins/enrichers/AiTopicEnricher.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiTopicsEnricher = void 0;
class AiTopicsEnricher {
    constructor(config) {
        this.provider = config.provider;
        this.maxTokens = config.maxTokens;
        this.thresholdLength = config.thresholdLength ?? 300;
    }
    async enrich(contentItems) {
        const enrichedContent = [];
        const thresholdLength = this.thresholdLength || 300;
        for (const contentItem of contentItems) {
            if (!contentItem || !contentItem.text) {
                enrichedContent.push(contentItem);
                continue;
            }
            if (contentItem.text.length < thresholdLength) {
                enrichedContent.push(contentItem);
                continue;
            }
            try {
                const topics = await this.provider.topics(contentItem.text);
                enrichedContent.push({
                    ...contentItem,
                    topics,
                });
            }
            catch (error) {
                console.error("Error creating topics: ", error);
                enrichedContent.push(contentItem);
            }
        }
        return enrichedContent;
    }
}
exports.AiTopicsEnricher = AiTopicsEnricher;
