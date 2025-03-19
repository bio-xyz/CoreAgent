import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import fs from 'fs';
import path from 'path';

interface DiscordNotifierConfig {
  name: string;
  botToken: string;
  channelIds: string[];
  outputPath?: string;
}

export class DiscordNotifier {
  public name: string;
  private botToken: string;
  private channelIds: string[];
  private client: Client;
  private outputPath: string;

  constructor(config: DiscordNotifierConfig) {
    this.name = config.name;
    this.botToken = config.botToken;
    this.channelIds = config.channelIds;
    this.outputPath = config.outputPath || './output';
    
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
    });
  }

  async init(): Promise<void> {
    if (!this.client.isReady()) {
      try {
        await this.client.login(this.botToken);
        console.log(`DiscordNotifier initialized with ${this.channelIds.length} channels`);
      } catch (error) {
        console.error('Error logging in to Discord:', error);
      }
    }
  }

  async sendSummary(dateStr: string, sourceLinksByTopic?: Record<string, string[]>): Promise<void> {
    try {
      if (!this.client.isReady()) {
        await this.init();
      }

      // Check if summary exists for the given date
      const mdFilePath = path.join(this.outputPath, 'md', `${dateStr}.md`);
      const jsonFilePath = path.join(this.outputPath, 'json', `${dateStr}.json`);
      
      if (!fs.existsSync(mdFilePath)) {
        console.log(`No summary found for date ${dateStr}`);
        return;
      }

      // Read the summary file
      let summaryContent = fs.readFileSync(mdFilePath, 'utf-8');
      
      // Collect all source links from the JSON data
      const allSourceLinks: string[] = [];
      
      let jsonData: any = null;
      if (fs.existsSync(jsonFilePath)) {
        try {
          jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
          console.log('JSON data loaded successfully. Categories count:', jsonData?.categories?.length || 0);
          
          // Extract all source links from the JSON data
          if (jsonData && jsonData.categories) {
            jsonData.categories.forEach((category: any) => {
              if (category.sourceLinks && Array.isArray(category.sourceLinks)) {
                allSourceLinks.push(...category.sourceLinks);
              }
            });
          }
          
          console.log(`Extracted ${allSourceLinks.length} source links from JSON data`);
        } catch (e) {
          console.log('Error parsing JSON file, continuing with markdown only:', e);
        }
      }
      
      // Add any source links from the passed sourceLinksByTopic
      if (sourceLinksByTopic) {
        Object.values(sourceLinksByTopic).forEach(links => {
          allSourceLinks.push(...links);
        });
      }
      
      // Remove duplicates
      const uniqueSourceLinks = [...new Set(allSourceLinks)];
      console.log(`Using ${uniqueSourceLinks.length} unique source links`);

      // Process the markdown content
      const processedContent = this.processMarkdownWithSources(summaryContent, uniqueSourceLinks);
      
      // Parse the processed content into sections
      const sections = this.parseMarkdownSections(processedContent);
      console.log(`Found ${sections.length} sections in the markdown content`);
      
      // Send to all configured channels
      for (const channelId of this.channelIds) {
        try {
          const channel = await this.client.channels.fetch(channelId);
          
          if (!channel || !channel.isTextBased()) {
            console.warn(`Channel ID ${channelId} is not a text channel or does not exist.`);
            continue;
          }

          const textChannel = channel as TextChannel;

          // Send initial message
          await textChannel.send(`**Daily Summary for ${dateStr}**`);
          
          // Send each section
          for (const section of sections) {
            const { content } = section;
            console.log(`Processing section with ${content.split('\n').length} lines`);
            
            // Send the section content
            const contentChunks = this.chunkMessage(content, 1900);
            for (const chunk of contentChunks) {
              await textChannel.send(chunk);
            }
          }
          
          console.log(`Summary for ${dateStr} sent to channel ${channelId}`);
        } catch (error) {
          console.error(`Error sending message to channel ${channelId}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error in sendSummary for ${dateStr}:`, error);
    }
  }
  
  // Process markdown content to add source references
  private processMarkdownWithSources(content: string, sourceLinks: string[]): string {
    if (sourceLinks.length === 0) {
      console.log('No source links to add');
      return content;
    }
    
    // Check if the content already contains source references
    const hasSourceSectionRegex = /##?\s+Sources/i;
    const hasInlineSourcesRegex = /\*\[[^\]]+\]\([^)]+\)\*/;
    
    if (hasInlineSourcesRegex.test(content)) {
      console.log('Content already has inline source references');
      return content;
    }
    
    // Skip adding references if there's already a Sources section
    if (hasSourceSectionRegex.test(content)) {
      console.log('Content already has a Sources section');
      // The sources are already included in the markdown
      return content;
    }
    
    // Process the content line by line
    const lines = content.split('\n');
    const processedLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this is a bullet point line
      if (line.match(/^\s*[\*\-\+]\s+/)) {
        // Find a source link that might match this content
        const linkIndex = this.findMatchingLinkIndex(line, sourceLinks);
        
        if (linkIndex >= 0) {
          // Add the link at the end of the bullet point
          processedLines.push(`${line} *${sourceLinks[linkIndex]}*`);
        } else {
          processedLines.push(line);
        }
      } else {
        processedLines.push(line);
      }
    }
    
    return processedLines.join('\n');
  }
  
  // Find a matching source link for a line of content
  private findMatchingLinkIndex(line: string, sourceLinks: string[]): number {
    // Extract possible match terms from the line
    const lowerLine = line.toLowerCase();
    
    // Try to find a source link that contains terms from this line
    for (let i = 0; i < sourceLinks.length; i++) {
      const link = sourceLinks[i];
      
      // Check if the link appears directly in the line
      if (line.includes(link)) {
        return i;
      }
      
      // Check for Discord links
      if (link.includes('discord.com/channels') && lowerLine.includes('discord')) {
        return i;
      }
      
      // Check for other potential matches based on content keywords
      if (
        (lowerLine.includes('twitter') && link.includes('twitter.com')) ||
        (lowerLine.includes('github') && link.includes('github.com')) ||
        (lowerLine.includes('blog') && link.includes('/blog'))
      ) {
        return i;
      }
    }
    
    return -1; // No match found
  }
  
  // Parse markdown into sections by heading
  private parseMarkdownSections(markdown: string): { topic: string, content: string }[] {
    const sections: { topic: string, content: string }[] = [];
    
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
      } else {
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
  private chunkMessage(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    
    let currentChunk = '';
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxLength) {
        chunks.push(currentChunk);
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }

  async close(): Promise<void> {
    if (this.client.isReady()) {
      this.client.destroy();
    }
  }
} 