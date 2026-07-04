import { IAIService } from '../../domain/services/IAIService';

export interface SuggestedMetadata {
  title: string;
  description: string;
  category: string;
  tags: string[];
}

export class SuggestMetadata {
  constructor(private aiService: IAIService) {}

  async execute(content: string, model: string): Promise<SuggestedMetadata | null> {
    const systemPrompt = `You are a professional prompt engineer metadata analyzer. 
Analyze the provided prompt template and generate high-quality metadata.
You MUST respond ONLY with a valid JSON object matching the following structure:
{
  "title": "A short, descriptive title",
  "description": "A concise summary of what the prompt template does",
  "category": "One of: Development, Creative Writing, Analysis, Marketing, Personal, Utilities",
  "tags": ["up to 4 descriptive tags, lowercase, alphanumeric, separated by commas"]
}
Do not write any markdown codeblock backticks or explanation. Just return pure JSON.`;

    const promptText = `Analyze this prompt template:\n\n${content}`;

    try {
      const response = await this.aiService.generate(promptText, model, systemPrompt);
      
      // Clean potential JSON markdown wrapping
      let cleanedJson = response.trim();
      if (cleanedJson.startsWith('```')) {
        const lines = cleanedJson.split('\n');
        cleanedJson = lines.slice(1, lines.length - 1).join('\n').trim();
      }
      if (cleanedJson.startsWith('json')) {
        cleanedJson = cleanedJson.substring(4).trim();
      }

      const parsed: SuggestedMetadata = JSON.parse(cleanedJson);
      return {
        title: parsed.title || 'Suggested Prompt Title',
        description: parsed.description || '',
        category: parsed.category || 'Utilities',
        tags: Array.isArray(parsed.tags) ? parsed.tags : []
      };
    } catch (error) {
      console.error('Failed to suggest metadata using AI:', error);
      return null;
    }
  }
}
