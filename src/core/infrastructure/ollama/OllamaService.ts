import { IAIService } from '../../domain/services/IAIService';

export class OllamaService implements IAIService {
  private baseUrl: string;

  constructor(baseUrl = 'http://127.0.0.1:11434') {
    this.baseUrl = baseUrl;
  }

  async isOnline(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async getModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];
      const data: any = await response.json();
      return (data.models || []).map((model: any) => model.name);
    } catch {
      return [];
    }
  }

  async generate(prompt: string, model: string, systemPrompt?: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          system: systemPrompt,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama response error: ${response.statusText}`);
      }

      const data: any = await response.json();
      return data.response || '';
    } catch (error) {
      console.error(`Ollama generate error (model: ${model}):`, error);
      throw error;
    }
  }

  async generateStream(prompt: string, model: string, onChunk: (text: string) => void): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama response error: ${response.statusText}`);
      }

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.response) {
              onChunk(parsed.response);
            }
          } catch (e) {
            console.error('Failed to parse stream line:', line, e);
          }
        }
      }

      if (buffer.trim().length > 0) {
        try {
          const parsed = JSON.parse(buffer);
          if (parsed.response) {
            onChunk(parsed.response);
          }
        } catch {}
      }
    } catch (error) {
      console.error(`Ollama generateStream error (model: ${model}):`, error);
      throw error;
    }
  }

  async embed(prompt: string, model: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt })
      });

      if (!response.ok) {
        const altResponse = await fetch(`${this.baseUrl}/api/embed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, input: prompt })
        });
        if (!altResponse.ok) {
          throw new Error(`Ollama embed error: ${altResponse.statusText}`);
        }
        const data: any = await altResponse.json();
        return data.embeddings?.[0] || [];
      }

      const data: any = await response.json();
      return data.embedding || [];
    } catch (error) {
      console.error(`Ollama embed error (model: ${model}):`, error);
      throw error;
    }
  }
}
