import { IPromptRepository } from '../../domain/repositories/IPromptRepository';
import { Category } from '../../domain/entities/Category';
import { Collection } from '../../domain/entities/Collection';
import { Prompt } from '../../domain/entities/Prompt';

export class ManageCategories {
  constructor(private promptRepo: IPromptRepository) {}

  async create(id: string, name: string, parentId: string | null = null): Promise<Category> {
    const category = new Category(id, name, parentId, new Date());
    return this.promptRepo.createCategory(category);
  }

  async list(): Promise<Category[]> {
    return this.promptRepo.listCategories();
  }

  async delete(id: string): Promise<boolean> {
    return this.promptRepo.deleteCategory(id);
  }
}

export class ManageCollections {
  constructor(private promptRepo: IPromptRepository) {}

  async create(id: string, name: string, description: string = ''): Promise<Collection> {
    const collection = new Collection(id, name, description, new Date());
    return this.promptRepo.createCollection(collection);
  }

  async list(): Promise<Collection[]> {
    return this.promptRepo.listCollections();
  }

  async delete(id: string): Promise<boolean> {
    return this.promptRepo.deleteCollection(id);
  }

  async addPrompt(promptId: string, collectionId: string): Promise<boolean> {
    return this.promptRepo.addPromptToCollection(promptId, collectionId);
  }

  async removePrompt(promptId: string, collectionId: string): Promise<boolean> {
    return this.promptRepo.removePromptFromCollection(promptId, collectionId);
  }
}

export class ManageFavorites {
  constructor(private promptRepo: IPromptRepository) {}

  async add(promptId: string): Promise<boolean> {
    return this.promptRepo.addFavorite(promptId);
  }

  async remove(promptId: string): Promise<boolean> {
    return this.promptRepo.removeFavorite(promptId);
  }

  async isFavorite(promptId: string): Promise<boolean> {
    return this.promptRepo.isFavorite(promptId);
  }

  async list(): Promise<Prompt[]> {
    return this.promptRepo.listFavorites();
  }
}
