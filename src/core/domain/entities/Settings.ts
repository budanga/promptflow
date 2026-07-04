export class Settings {
  constructor(
    public ollamaEndpoint: string = 'http://127.0.0.1:11434',
    public defaultPromptModel: string = 'qwen3:14b',
    public defaultCodeModel: string = 'qwen3:coder',
    public defaultEmbeddingModel: string = 'embeddinggemma',
    public theme: 'light' | 'dark' = 'dark',
    public language: string = 'en',
    public keyboardShortcuts: Record<string, string> = {}
  ) {}

  static fromJson(json: string): Settings {
    try {
      const data = JSON.parse(json);
      return new Settings(
        data.ollamaEndpoint,
        data.defaultPromptModel,
        data.defaultCodeModel,
        data.defaultEmbeddingModel,
        data.theme,
        data.language,
        data.keyboardShortcuts
      );
    } catch {
      return new Settings();
    }
  }

  toJson(): string {
    return JSON.stringify({
      ollamaEndpoint: this.ollamaEndpoint,
      defaultPromptModel: this.defaultPromptModel,
      defaultCodeModel: this.defaultCodeModel,
      defaultEmbeddingModel: this.defaultEmbeddingModel,
      theme: this.theme,
      language: this.language,
      keyboardShortcuts: this.keyboardShortcuts
    });
  }
}
