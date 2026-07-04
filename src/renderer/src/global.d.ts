import { Prompt, PromptVersion, Category, Collection, Tag } from '../../shared/types';

interface IpcApi {
  getDbStatus: () => Promise<boolean>;
  
  // Prompts
  createPrompt: (input: {
    id: string;
    title: string;
    description: string;
    content: string;
    categoryId: string | null;
    notes: string;
    tags: Array<{ id: string; name: string }>;
  }) => Promise<Prompt>;
  
  updatePrompt: (input: {
    id: string;
    title: string;
    description: string;
    content?: string;
    changeDescription?: string;
    categoryId: string | null;
    notes: string;
    tags: Array<{ id: string; name: string }>;
  }) => Promise<Prompt>;
  
  getPrompt: (id: string) => Promise<{
    prompt: Prompt;
    latestVersion: PromptVersion;
    versions: PromptVersion[];
    collections: Collection[];
  } | null>;
  
  deletePrompt: (id: string) => Promise<boolean>;
  
  listPrompts: (filter?: {
    isArchived?: boolean;
    categoryId?: string | null;
    collectionId?: string;
    tagId?: string;
    keyword?: string;
    onlyFavorites?: boolean;
  }) => Promise<Prompt[]>;

  // Categories
  createCategory: (category: { id: string; name: string; parentId: string | null }) => Promise<Category>;
  listCategories: () => Promise<Category[]>;
  deleteCategory: (id: string) => Promise<boolean>;

  // Collections
  createCollection: (collection: { id: string; name: string; description: string }) => Promise<Collection>;
  listCollections: () => Promise<Collection[]>;
  deleteCollection: (id: string) => Promise<boolean>;
  addPromptToCollection: (promptId: string, collectionId: string) => Promise<boolean>;
  removePromptFromCollection: (promptId: string, collectionId: string) => Promise<boolean>;

  // Favorites
  addFavorite: (promptId: string) => Promise<boolean>;
  removeFavorite: (promptId: string) => Promise<boolean>;
  isFavorite: (promptId: string) => Promise<boolean>;
  listFavorites: () => Promise<Prompt[]>;

  // Tags
  listTags: () => Promise<Tag[]>;

  // Portability
  exportPrompt: (id: string, format: 'markdown' | 'json') => Promise<boolean>;
  importPrompt: () => Promise<boolean>;

  // Settings
  getSetting: (key: string) => Promise<string | null>;
  setSetting: (key: string, value: string) => Promise<boolean>;

  // AI Operations
  getAiStatus: () => Promise<boolean>;
  getAiModels: () => Promise<string[]>;
  suggestMetadata: (content: string, model: string) => Promise<{ title: string; description: string; category: string; tags: string[] } | null>;
  improvePrompt: (content: string, action: 'simplify' | 'detail' | 'explain' | 'check_ambiguity', model: string) => Promise<{ improvedContent: string; explanation: string }>;
  detectDuplicate: (title: string, content: string, model: string) => Promise<{ isDuplicate: boolean; duplicateOfPromptId: string | null; duplicateOfTitle: string | null; reason: string | null }>;
  generatePrompt: (requirement: string, model: string) => Promise<{ title: string; description: string; content: string }>;

  // Semantic Search
  checkSemanticStatus: (targetModel: string) => Promise<{ isStale: boolean; staleCount: number }>;
  rebuildSemanticIndex: (targetModel: string) => Promise<boolean>;
  onSemanticProgress: (callback: (data: { percent: number; current: number; total: number }) => void) => () => void;
  semanticSearch: (query: string, targetModel: string, limit?: number) => Promise<Prompt[]>;

  // Playground Comparison
  runPlayground: (compiledPrompt: string, models: string[], executionId: string, promptId?: string | null) => Promise<boolean>;
  getPlaygroundHistory: (promptId?: string | null) => Promise<Array<{ id: string; promptId: string | null; compiledPrompt: string; model: string; response: string; createdAt: string }>>;
  onPlaygroundChunk: (callback: (data: { executionId: string; model: string; text: string; done: boolean }) => void) => () => void;
}

declare global {
  interface Window {
    api?: IpcApi;
  }
}
export {};
