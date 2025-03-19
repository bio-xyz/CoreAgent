"use strict";
// src/plugins/ai/OpenAIProvider.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIProvider = void 0;
const openai_1 = __importDefault(require("openai"));
class OpenAIProvider {
    constructor(config) {
        this.openaiDirect = null; // For image generation
        this.canGenerateImages = false;
        this.name = config.name;
        this.useOpenRouter = config.useOpenRouter || false;
        // Initialize main client (OpenRouter or OpenAI)
        const openAIConfig = {
            apiKey: config.apiKey
        };
        if (this.useOpenRouter) {
            openAIConfig.baseURL = "https://openrouter.ai/api/v1";
            openAIConfig.defaultHeaders = {
                "HTTP-Referer": config.siteUrl || "",
                "X-Title": config.siteName || "",
            };
            this.model = config.model?.includes("/") ? config.model : `openai/${config.model || "gpt-4o-mini"}`;
            // Create separate OpenAI client for image generation if OpenAI key is provided
            const openaiKey = process.env.OPENAI_DIRECT_KEY;
            if (openaiKey) {
                this.openaiDirect = new openai_1.default({
                    apiKey: openaiKey
                });
                this.canGenerateImages = true;
            }
        }
        else {
            this.model = config.model || "gpt-4o-mini";
            this.canGenerateImages = true;
        }
        this.openai = new openai_1.default(openAIConfig);
        this.temperature = config.temperature ?? 0.7;
    }
    async summarize(prompt) {
        try {
            const completion = await this.openai.chat.completions.create({
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                temperature: this.temperature
            });
            return completion.choices[0]?.message?.content || "";
        }
        catch (e) {
            console.error("Error in summarize:", e);
            throw e;
        }
    }
    async topics(text) {
        try {
            const prompt = `Provide up to 6 words that describe the topic of the following text:\n\n"${text}.\n\n Response format MUST be formatted in this way, the words must be strings:\n\n[ \"word1\", \"word2\", \"word3\"]\n`;
            const completion = await this.openai.chat.completions.create({
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                temperature: this.temperature
            });
            return JSON.parse(completion.choices[0]?.message?.content || "[]");
        }
        catch (e) {
            console.error("Error in topics:", e);
            return [];
        }
    }
    async image(text) {
        if (!this.canGenerateImages) {
            console.warn("Image generation is not available. When using OpenRouter, set OPENAI_DIRECT_KEY for image generation.");
            return [];
        }
        try {
            // Use direct OpenAI client for image generation
            const client = this.useOpenRouter ? this.openaiDirect : this.openai;
            const prompt = `Create an image that depicts the following text:\n\n"${text}.\n\n Response format MUST be formatted in this way, the words must be strings:\n\n{ \"images\": \"<image_url>\"}\n`;
            const params = {
                model: "dall-e-3",
                prompt: text,
                n: 1,
                size: "1024x1024",
            };
            const image = await client.images.generate(params);
            console.log(image.data[0].url);
            return JSON.parse(image.data[0].url || "[]");
        }
        catch (e) {
            console.error("Error in image generation:", e);
            return [];
        }
    }
}
exports.OpenAIProvider = OpenAIProvider;
