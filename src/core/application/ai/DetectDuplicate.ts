import { IPromptRepository } from '../../domain/repositories/IPromptRepository';
import { IAIService } from '../../domain/services/IAIService';
import { Prompt } from '../../../shared/types';

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  duplicateOfPromptId: string | null;
  duplicateOfTitle: string | null;
  reason: string | null;
}

function getJaccardSimilarity(str1: string, str2: string): number {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const words1 = new Set(clean(str1));
  const words2 = new Set(clean(str2));
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  return intersection.size / union.size;
}

export class DetectDuplicate {
  constructor(
    private promptRepo: IPromptRepository,
    private aiService: IAIService
  ) {}

  async execute(title: string, content: string, model: string): Promise<DuplicateDetectionResult> {
    try {
      // 1. Get all prompts from repo
      const allPrompts = await this.promptRepo.listPrompts();
      
      // Filter out empty entries and calculate Jaccard similarity against title + description
      const candidates = allPrompts
        .map(p => {
          const sim = getJaccardSimilarity(`${title} ${content}`, `${p.title} ${p.description}`);
          return { prompt: p, similarity: sim };
        })
        .filter(c => c.similarity > 0.05) // Any small keyword overlap
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 3); // Compare against top 3 most similar prompts

      if (candidates.length === 0) {
        return { isDuplicate: false, duplicateOfPromptId: null, duplicateOfTitle: null, reason: null };
      }

      // 2. Query Ollama to perform semantic comparison
      const systemPrompt = `You are a semantic duplicate detector for an AI prompt library.
Analyze the new prompt title and content, and compare it against the list of existing prompts.
Decide if the new prompt is a semantic duplicate (does the same task with identical or almost identical logic).
You MUST respond ONLY with a valid JSON object matching the following structure:
{
  "isDuplicate": true or false,
  "duplicateOfPromptId": "the id of the duplicate prompt, or null if false",
  "reason": "a short sentence explaining why it is or is not a duplicate"
}
Do not write any markdown codeblock backticks or explanations. Just return pure JSON.`;

      const candidatesList = candidates.map(c => `ID: ${c.prompt.id}\nTitle: ${c.prompt.title}\nDescription: ${c.prompt.description}`).join('\n\n');
      const promptText = `NEW PROMPT:
Title: ${title}
Content: ${content}

EXISTING CANDIDATES:
${candidatesList}`;

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

      const parsed = JSON.parse(cleanedJson);
      
      if (parsed.isDuplicate && parsed.duplicateOfPromptId) {
        const matched = candidates.find(c => c.prompt.id === parsed.duplicateOfPromptId);
        return {
          isDuplicate: true,
          duplicateOfPromptId: parsed.duplicateOfPromptId,
          duplicateOfTitle: matched?.prompt.title || 'Matching Prompt',
          reason: parsed.reason || 'Semantic duplicate detected.'
        };
      }

      return { isDuplicate: false, duplicateOfPromptId: null, duplicateOfTitle: null, reason: null };
    } catch (error) {
      console.error('Failed to run duplicate detection using AI:', error);
      return { isDuplicate: false, duplicateOfPromptId: null, duplicateOfTitle: null, reason: null };
    }
  }
}
