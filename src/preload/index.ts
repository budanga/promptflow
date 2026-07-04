import { contextBridge, ipcRenderer } from 'electron';

// Expose safe, sandboxed window.api functions for React renderer
contextBridge.exposeInMainWorld('api', {
  getDbStatus: async (): Promise<boolean> => {
    return ipcRenderer.invoke('db:status');
  },

  // Prompts
  createPrompt: async (input: {
    id: string;
    title: string;
    description: string;
    content: string;
    categoryId: string | null;
    notes: string;
    tags: Array<{ id: string; name: string }>;
  }) => {
    return ipcRenderer.invoke('prompts:create', input);
  },

  updatePrompt: async (input: {
    id: string;
    title: string;
    description: string;
    content?: string;
    changeDescription?: string;
    categoryId: string | null;
    notes: string;
    isArchived?: boolean;
    tags: Array<{ id: string; name: string }>;
  }) => {
    return ipcRenderer.invoke('prompts:update', input);
  },

  getPrompt: async (id: string) => {
    return ipcRenderer.invoke('prompts:get', id);
  },

  deletePrompt: async (id: string) => {
    return ipcRenderer.invoke('prompts:delete', id);
  },

  listPrompts: async (filter?: {
    isArchived?: boolean;
    categoryId?: string | null;
    collectionId?: string;
    tagId?: string;
    keyword?: string;
    onlyFavorites?: boolean;
  }) => {
    return ipcRenderer.invoke('prompts:list', filter);
  },

  exportPrompt: async (id: string, format: 'markdown' | 'json') => {
    return ipcRenderer.invoke('prompts:export', { id, format });
  },

  importPrompt: async () => {
    return ipcRenderer.invoke('prompts:import');
  },

  // Settings
  getSetting: async (key: string): Promise<string | null> => {
    return ipcRenderer.invoke('settings:get', key);
  },

  setSetting: async (key: string, value: string): Promise<boolean> => {
    return ipcRenderer.invoke('settings:set', { key, value });
  },

  // AI Operations
  getAiStatus: async (): Promise<boolean> => {
    return ipcRenderer.invoke('ai:status');
  },

  getAiModels: async (): Promise<string[]> => {
    return ipcRenderer.invoke('ai:get-models');
  },

  suggestMetadata: async (content: string, model: string) => {
    return ipcRenderer.invoke('ai:suggest-metadata', { content, model });
  },

  improvePrompt: async (content: string, action: 'simplify' | 'detail' | 'explain' | 'check_ambiguity', model: string) => {
    return ipcRenderer.invoke('ai:improve-prompt', { content, action, model });
  },

  detectDuplicate: async (title: string, content: string, model: string) => {
    return ipcRenderer.invoke('ai:detect-duplicate', { title, content, model });
  },

  generatePrompt: async (requirement: string, model: string) => {
    return ipcRenderer.invoke('ai:generate-prompt', { requirement, model });
  },

  // Categories
  createCategory: async (category: { id: string; name: string; parentId: string | null }) => {
    return ipcRenderer.invoke('categories:create', category);
  },

  listCategories: async () => {
    return ipcRenderer.invoke('categories:list');
  },

  deleteCategory: async (id: string) => {
    return ipcRenderer.invoke('categories:delete', id);
  },

  // Collections
  createCollection: async (collection: { id: string; name: string; description: string }) => {
    return ipcRenderer.invoke('collections:create', collection);
  },

  listCollections: async () => {
    return ipcRenderer.invoke('collections:list');
  },

  deleteCollection: async (id: string) => {
    return ipcRenderer.invoke('collections:delete', id);
  },

  addPromptToCollection: async (promptId: string, collectionId: string) => {
    return ipcRenderer.invoke('collections:add-prompt', { promptId, collectionId });
  },

  removePromptFromCollection: async (promptId: string, collectionId: string) => {
    return ipcRenderer.invoke('collections:remove-prompt', { promptId, collectionId });
  },

  // Favorites
  addFavorite: async (promptId: string) => {
    return ipcRenderer.invoke('favorites:add', promptId);
  },

  removeFavorite: async (promptId: string) => {
    return ipcRenderer.invoke('favorites:remove', promptId);
  },

  isFavorite: async (promptId: string) => {
    return ipcRenderer.invoke('favorites:is', promptId);
  },

  listFavorites: async () => {
    return ipcRenderer.invoke('favorites:list');
  },

  // Tags
  listTags: async () => {
    return ipcRenderer.invoke('tags:list');
  },

  // Semantic Search
  checkSemanticStatus: async (targetModel: string) => {
    return ipcRenderer.invoke('semantic:check-status', targetModel);
  },

  rebuildSemanticIndex: async (targetModel: string) => {
    return ipcRenderer.invoke('semantic:rebuild', targetModel);
  },

  onSemanticProgress: (callback: (data: { percent: number; current: number; total: number }) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('semantic:rebuild-progress', listener);
    return () => {
      ipcRenderer.removeListener('semantic:rebuild-progress', listener);
    };
  },

  semanticSearch: async (query: string, targetModel: string, limit?: number) => {
    return ipcRenderer.invoke('semantic:search', { query, targetModel, limit });
  },

  // Playground Comparison
  runPlayground: async (compiledPrompt: string, models: string[], executionId: string, promptId?: string | null) => {
    return ipcRenderer.invoke('playground:run', { compiledPrompt, models, executionId, promptId });
  },

  getPlaygroundHistory: async (promptId?: string | null) => {
    return ipcRenderer.invoke('playground:get-history', promptId);
  },

  onPlaygroundChunk: (callback: (data: { executionId: string; model: string; text: string; done: boolean }) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('playground:chunk', listener);
    return () => {
      ipcRenderer.removeListener('playground:chunk', listener);
    };
  }
});
