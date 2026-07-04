import { IAIService } from '../../domain/services/IAIService';

export type ImprovementAction = 'simplify' | 'detail' | 'explain' | 'check_ambiguity';

export interface ImprovementResult {
  improvedContent: string;
  explanation: string;
}

export class ImprovePrompt {
  constructor(private aiService: IAIService) {}

  async execute(content: string, action: ImprovementAction, model: string): Promise<ImprovementResult> {
    let instruction = '';
    
    switch (action) {
      case 'simplify':
        instruction = 'Simplify the prompt template. Remove verbose explanations, clarify instructions, and ensure it is extremely direct and easy for an AI to parse. Do not alter double-brace variables like {{placeholder}}.';
        break;
      case 'detail':
        instruction = 'Expand the prompt template with details. Add clear context, output formatting constraints, step-by-step reasoning instructions, and style controls. Keep double-brace variables like {{placeholder}} intact.';
        break;
      case 'explain':
        instruction = 'Explain this prompt template. Describe its purpose, how the variables function, and tips on how to get the best responses when running it.';
        break;
      case 'check_ambiguity':
        instruction = 'Analyze this prompt template for ambiguities, contradictions, or logical gaps. Recommend structural fixes. Ensure variables are used correctly.';
        break;
    }

    const systemPrompt = `You are a professional prompt engineering editor and auditor. 
Apply the requested action to the provided prompt template. 
Your output MUST contain two distinct sections separated by a divider "===EXPLANATION===":
1. The improved/explained prompt text (or suggestions).
2. A short paragraph explaining your changes or recommendations.

Example structure:
[Your improved text here]
===EXPLANATION===
[Your explanation of changes here]`;

    const promptText = `Action: ${action.toUpperCase()}
Instruction: ${instruction}

Prompt Template:
${content}`;

    try {
      const response = await this.aiService.generate(promptText, model, systemPrompt);
      const parts = response.split('===EXPLANATION===');
      
      const improvedContent = parts[0].trim();
      const explanation = parts.length > 1 ? parts[1].trim() : 'Changes applied successfully.';

      return {
        improvedContent,
        explanation
      };
    } catch (error) {
      console.error(`Failed to execute AI improve action (${action}):`, error);
      throw error;
    }
  }
}
