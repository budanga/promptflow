import { IPromptRepository } from '../../domain/repositories/IPromptRepository';
import { CreatePrompt } from './CreatePrompt';

export class ImportPrompt {
  private createPromptUseCase: CreatePrompt;

  constructor(private promptRepo: IPromptRepository) {
    this.createPromptUseCase = new CreatePrompt(promptRepo);
  }

  async execute(rawContent: string, fileExtension: string): Promise<boolean> {
    try {
      const ext = fileExtension.toLowerCase().replace(/^\./, '');
      
      if (ext === 'json') {
        const data = JSON.parse(rawContent);
        // Supports either complete PromptDetails structure or simple JSON object
        if (data.prompt && data.latestVersion) {
          await this.createPromptUseCase.execute({
            id: `prompt_${Date.now()}`,
            title: data.prompt.title,
            description: data.prompt.description || '',
            content: data.latestVersion.content,
            categoryId: data.prompt.categoryId,
            notes: data.prompt.notes || '',
            tags: data.prompt.tags || []
          });
        } else {
          // Fallback simple JSON
          await this.createPromptUseCase.execute({
            id: `prompt_${Date.now()}`,
            title: data.title || 'Imported JSON Prompt',
            description: data.description || '',
            content: data.content || data.prompt || '',
            categoryId: null,
            notes: data.notes || '',
            tags: Array.isArray(data.tags) ? data.tags.map((t: any) => typeof t === 'string' ? { id: t, name: t } : t) : []
          });
        }
        return true;
      }

      // Default parsing for Markdown (.md) or Text (.txt)
      let title = 'Imported Prompt';
      let description = '';
      let content = rawContent;
      let tags: Array<{ id: string; name: string }> = [];
      let notes = '';

      if (rawContent.startsWith('---')) {
        // Parse frontmatter
        const parts = rawContent.split('---');
        if (parts.length >= 3) {
          const frontmatter = parts[1];
          content = parts.slice(2).join('---').trim();
          
          // Parse lines
          const lines = frontmatter.split('\n');
          for (const line of lines) {
            const separatorIndex = line.indexOf(':');
            if (separatorIndex !== -1) {
              const key = line.substring(0, separatorIndex).trim().toLowerCase();
              const val = line.substring(separatorIndex + 1).trim();
              
              if (key === 'title') title = val;
              if (key === 'description') description = val;
              if (key === 'notes') notes = val;
              if (key === 'tags') {
                tags = val.split(',')
                  .map(t => t.trim())
                  .filter(t => t.length > 0)
                  .map(t => ({ id: `tag_${t.toLowerCase().replace(/[^a-z0-9]/g, '_')}`, name: t }));
              }
            }
          }
        }
      } else {
        // Simple plain TXT - try to guess title from first line
        const lines = rawContent.split('\n');
        if (lines.length > 0 && lines[0].trim().length > 0) {
          title = lines[0].replace(/^#\s*/, '').trim(); // Remove markdown title hashes if present
          if (lines.length > 1) {
            content = lines.slice(1).join('\n').trim();
          }
        }
      }

      await this.createPromptUseCase.execute({
        id: `prompt_${Date.now()}`,
        title,
        description,
        content,
        categoryId: null,
        notes,
        tags
      });

      return true;
    } catch (error) {
      console.error('Failed to parse and import prompt file:', error);
      return false;
    }
  }
}
