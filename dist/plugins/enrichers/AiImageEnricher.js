"use strict";
// src/plugins/enrichers/AiTopicEnricher.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiImageEnricher = void 0;
class AiImageEnricher {
    constructor(config) {
        this.provider = config.provider;
        this.maxTokens = config.maxTokens;
    }
    async enrich(contentItems) {
        const enrichedContent = [];
        const thresholdLength = this.thresholdLength || 300;
        for (const contentItem of contentItems) {
            let images = contentItem?.metadata?.images || [];
            if (!contentItem || !contentItem.text || images.length > 0) {
                enrichedContent.push(contentItem);
                continue;
            }
            if (contentItem.text.length < thresholdLength) {
                enrichedContent.push(contentItem);
                continue;
            }
            try {
                const image = await this.provider.image(contentItem.text);
                enrichedContent.push({
                    ...contentItem,
                    metadata: {
                        ...contentItem.metadata,
                        images: image,
                    }
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
exports.AiImageEnricher = AiImageEnricher;
