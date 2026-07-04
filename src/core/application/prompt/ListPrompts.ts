import { IPromptRepository, PromptListFilter } from '../../domain/repositories/IPromptRepository';
import { Prompt } from '../../domain/entities/Prompt';

export class ListPrompts {
  constructor(private promptRepo: IPromptRepository) {}

  async execute(filter?: PromptListFilter): Promise<Prompt[]> {
    return this.promptRepo.listPrompts(filter);
  }
}
