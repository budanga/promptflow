import { IPromptRepository } from '../../domain/repositories/IPromptRepository';
import { Prompt } from '../../domain/entities/Prompt';
import { Tag } from '../../domain/entities/Tag';

export interface CreatePromptInput {
  id: string;
  title: string;
  description: string;
  content: string;
  categoryId: string | null;
  notes: string;
  tags: Array<{ id: string; name: string }>;
}

export class CreatePrompt {
  constructor(private promptRepo: IPromptRepository) {}

  async execute(input: CreatePromptInput): Promise<Prompt> {
    const tags = input.tags.map(t => new Tag(t.id, t.name));
    
    // Ensure all tags are registered in the global tag pool
    for (const tag of tags) {
      await this.promptRepo.createTag(tag);
    }

    const prompt = new Prompt(
      input.id,
      input.title,
      input.description,
      input.categoryId,
      input.notes,
      false, // Initially not archived
      new Date(),
      new Date(),
      tags
    );

    return this.promptRepo.createPrompt(prompt, input.content);
  }
}
