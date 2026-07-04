import { Prompt } from '../entities/Prompt';
import { PromptVersion } from '../entities/PromptVersion';
import { Category } from '../entities/Category';
import { Collection } from '../entities/Collection';
import { Tag } from '../entities/Tag';

export interface PromptListFilter {
  isArchived?: boolean;
  categoryId?: string | null;
  collectionId?: string;
  tagId?: string;
  keyword?: string;
  onlyFavorites?: boolean;
}

export interface IPromptRepository {
  // Prompt CRUD
  createPrompt(prompt: Prompt, initialContent: string): Promise<Prompt>;
  getPromptById(id: string): Promise<{ prompt: Prompt; latestVersion: PromptVersion; versions: PromptVersion[] } | null>;
  updatePrompt(prompt: Prompt, newContent?: string, changeDescription?: string): Promise<Prompt>;
  deletePrompt(id: string): Promise<boolean>;
  listPrompts(filter?: PromptListFilter): Promise<Prompt[]>;
  saveVersionEmbedding(versionId: string, embedding: Float32Array, model: string): Promise<boolean>;
  listAllVersions(): Promise<PromptVersion[]>;

  // Categories (Folders)
  createCategory(category: Category): Promise<Category>;
  listCategories(): Promise<Category[]>;
  deleteCategory(id: string): Promise<boolean>;

  // Collections
  createCollection(collection: Collection): Promise<Collection>;
  listCollections(): Promise<Collection[]>;
  deleteCollection(id: string): Promise<boolean>;
  addPromptToCollection(promptId: string, collectionId: string): Promise<boolean>;
  removePromptFromCollection(promptId: string, collectionId: string): Promise<boolean>;
  getCollectionsByPromptId(promptId: string): Promise<Collection[]>;

  // Tags
  createTag(tag: Tag): Promise<Tag>;
  listTags(): Promise<Tag[]>;
  addTagToPrompt(promptId: string, tagId: string): Promise<boolean>;
  removeTagFromPrompt(promptId: string, tagId: string): Promise<boolean>;

  // Favorites
  addFavorite(promptId: string): Promise<boolean>;
  removeFavorite(promptId: string): Promise<boolean>;
  isFavorite(promptId: string): Promise<boolean>;
  listFavorites(): Promise<Prompt[]>;
}
