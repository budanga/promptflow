export interface IAIService {
  generate(prompt: string, model: string, systemPrompt?: string): Promise<string>;
  generateStream(prompt: string, model: string, onChunk: (text: string) => void): Promise<void>;
  embed(prompt: string, model: string): Promise<number[]>;
  getModels(): Promise<string[]>;
  isOnline(): Promise<boolean>;
}
