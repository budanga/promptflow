import { IPromptRepository } from '../../domain/repositories/IPromptRepository';
import { Prompt } from '../../domain/entities/Prompt';
import { PromptVersion } from '../../domain/entities/PromptVersion';
import { Collection } from '../../domain/entities/Collection';

export interface PromptDetails {
  prompt: Prompt;
  latestVersion: PromptVersion;
  versions: PromptVersion[];
  collections: Collection[];
}

export class GetPromptDetails {
  constructor(private promptRepo: IPromptRepository) {}

  async execute(id: string): Promise<PromptDetails | null> {
    const data = await this.promptRepo.getPromptById(id);
    if (!data) return null;

    const collections = await this.promptRepo.getCollectionsByPromptId(id);

    return {
      prompt: data.prompt,
      latestVersion: data.latestVersion,
      versions: data.versions,
      collections
    };
  }
}
