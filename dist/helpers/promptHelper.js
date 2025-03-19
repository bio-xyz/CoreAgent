"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createJSONPromptForTopics = exports.createMarkdownPromptForJSON = void 0;
const createMarkdownPromptForJSON = (summaryData, dateStr) => {
    const jsonStr = JSON.stringify(summaryData, null, 2);
    return `You are an expert at converting structured JSON data into a highly optimized markdown report for language model processing.
    
The markdown should:
- Use clear, hierarchical headings
- Include bullet lists for key points
- Be concise and easy to parse
- Exclude any raw JSON output
- Maintain hierarchical structure
- Focus on key information

Given the following JSON summary for ${dateStr}, generate a markdown report accordingly:

${jsonStr}

Only return the final markdown text.`;
};
exports.createMarkdownPromptForJSON = createMarkdownPromptForJSON;
const createJSONPromptForTopics = (topic, objects, dateStr) => {
    let prompt = `Generate a summary for the topic. Focus on the following details:\n\n`;
    objects.forEach((item) => {
        prompt += `\n***source***\n`;
        if (item.text)
            prompt += `text: ${item.text}\n`;
        if (item.link)
            prompt += `sources: ${item.link}\n`;
        if (item.metadata?.photos)
            prompt += `photos: ${item.metadata?.photos}\n`;
        if (item.metadata?.videos)
            prompt += `videos: ${item.metadata?.videos}\n`;
        prompt += `\n***source_end***\n\n`;
    });
    prompt += `Provide a clear and concise summary based on the ***sources*** above for the topic. DO NOT PULL DATA FROM OUTSIDE SOURCES'${topic}'. Combine similar sources into a longer summary if it makes sense.\n\n`;
    prompt += `Response MUST be a valid JSON object containing:\n- 'title': The title of the topic.\n- 'content': A list of messages with keys 'text', 'sources', 'images', and 'videos'.\n\n`;
    return prompt;
};
exports.createJSONPromptForTopics = createJSONPromptForTopics;
