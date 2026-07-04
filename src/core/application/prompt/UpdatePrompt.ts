import { IPromptRepository } from '../../domain/repositories/IPromptRepository';
import { Prompt } from '../../domain/entities/Prompt';
import { Tag } from '../../domain/entities/Tag';

export interface UpdatePromptInput {
  id: string;
  title: string;
  description: string;
  content?: string;
  changeDescription?: string;
  categoryId: string | null;
  notes: string;
  isArchived?: boolean;
  tags: Array<{ id: string; name: string }>;
}

export class UpdatePrompt {
  constructor(private promptRepo: IPromptRepository) {}

  async execute(input: UpdatePromptInput): Promise<Prompt> {
    // 1. Fetch current prompt data
    const existing = await this.promptRepo.getPromptById(input.id);
    if (!existing) {
      throw new Error(`Prompt with ID ${input.id} not found.`);
    }

    const updatedTags = input.tags.map(t => new Tag(t.id, t.name));

    // 2. Resolve Tag Junction Changes
    const currentTagIds = new Set((existing.prompt.tags || []).map(t => t.id));
    const newTagIds = new Set(updatedTags.map(t => t.id));

    // Add tags that are not currently in prompt
    for (const tag of updatedTags) {
      if (!currentTagIds.has(tag.id)) {
        await this.promptRepo.createTag(tag);
        await this.promptRepo.addTagToPrompt(input.id, tag.id);
      }
    }

    // Remove tags that are no longer selected
    for (const currentTag of existing.prompt.tags || []) {
      if (!newTagIds.has(currentTag.id)) {
        await this.promptRepo.removeTagFromPrompt(input.id, currentTag.id);
      }
    }

    // 3. Create updated prompt instance
    const prompt = new Prompt(
      input.id,
      input.title,
      input.description,
      input.categoryId,
      input.notes,
      input.isArchived !== undefined ? input.isArchived : existing.prompt.isArchived,
      existing.prompt.createdAt,
      new Date(),
      updatedTags
    );

    // 4. Update prompt and optionally save new content version
    return this.promptRepo.updatePrompt(prompt, input.content, input.changeDescription);
  }
}
