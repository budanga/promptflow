import { create } from 'zustand';
import { Tag, Category, Collection, PromptVersion, Prompt, PromptDetails } from '../../../shared/types';
export type { Tag, Category, Collection, PromptVersion, Prompt, PromptDetails };

interface PromptState {
  prompts: Prompt[];
  categories: Category[];
  collections: Collection[];
  tags: Tag[];
  activePromptId: string | null;
  activePrompt: PromptDetails | null;
  
  // Filters & Search
  searchQuery: string;
  selectedCategoryId: string | null | undefined; // undefined means no category filter, null means uncategorized
  selectedCollectionId: string | null;
  selectedTagId: string | null;
  onlyFavorites: boolean;
  showArchived: boolean;
  
  // DB status
  dbStatus: boolean;

  // Configured AI Models
  metadataModel: string;
  improveModel: string;
  embeddingModel: string;
  loadSettings: () => Promise<void>;
  saveSettings: (metadataModel: string, improveModel: string, embeddingModel: string) => Promise<void>;

  // Semantic Search States
  isSemanticMode: boolean;
  setIsSemanticMode: (val: boolean) => void;
  searchStaleStatus: { isStale: boolean; staleCount: number };
  isRebuildingIndex: boolean;
  rebuildPercent: number;
  checkSemanticIndexStatus: () => Promise<void>;
  rebuildSemanticIndex: () => Promise<void>;

  // Actions
  init: () => Promise<void>;
  fetchPrompts: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchCollections: () => Promise<void>;
  fetchTags: () => Promise<void>;
  
  selectPrompt: (id: string | null) => Promise<void>;
  createPrompt: (title: string, content: string, description: string, categoryId: string | null, tags: Tag[]) => Promise<void>;
  updatePrompt: (id: string, updates: { title: string; description: string; content?: string; changeDescription?: string; categoryId: string | null; notes: string; tags: Tag[] }) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  
  // Favorite actions
  toggleFavorite: (id: string) => Promise<void>;

  // Category Actions
  createCategory: (name: string, parentId?: string | null) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  // Collection Actions
  createCollection: (name: string, description?: string) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  addPromptToCollection: (promptId: string, collectionId: string) => Promise<void>;
  removePromptFromCollection: (promptId: string, collectionId: string) => Promise<void>;

  // Portability Actions
  exportPrompt: (id: string, format: 'markdown' | 'json') => Promise<boolean>;
  importPrompt: () => Promise<boolean>;
  restoreVersion: (promptId: string, versionNumber: number, content: string) => Promise<void>;

  // Filter setters
  setSearchQuery: (query: string) => void;
  setSelectedCategoryId: (categoryId: string | null | undefined) => void;
  setSelectedCollectionId: (collectionId: string | null) => void;
  setSelectedTagId: (tagId: string | null) => void;
  setOnlyFavorites: (onlyFavs: boolean) => void;
  setShowArchived: (showArchived: boolean) => void;
}

export const usePromptStore = create<PromptState>((set, get) => ({
  prompts: [],
  categories: [],
  collections: [],
  tags: [],
  activePromptId: null,
  activePrompt: null,
  
  searchQuery: '',
  selectedCategoryId: undefined,
  selectedCollectionId: null,
  selectedTagId: null,
  onlyFavorites: false,
  showArchived: false,
  
  dbStatus: false,
  metadataModel: 'qwen3:14b',
  improveModel: 'qwen3:coder',
  embeddingModel: 'embeddinggemma',

  isSemanticMode: false,
  searchStaleStatus: { isStale: false, staleCount: 0 },
  isRebuildingIndex: false,
  rebuildPercent: 0,

  loadSettings: async () => {
    if (!window.api) return;
    const meta = await window.api.getSetting('metadataModel');
    const imp = await window.api.getSetting('improveModel');
    const emb = await window.api.getSetting('embeddingModel');
    set({
      metadataModel: meta || 'qwen3:14b',
      improveModel: imp || 'qwen3:coder',
      embeddingModel: emb || 'embeddinggemma',
    });
  },

  saveSettings: async (metadataModel, improveModel, embeddingModel) => {
    if (!window.api) return;
    await window.api.setSetting('metadataModel', metadataModel);
    await window.api.setSetting('improveModel', improveModel);
    await window.api.setSetting('embeddingModel', embeddingModel);
    set({ metadataModel, improveModel, embeddingModel });
    await get().checkSemanticIndexStatus();
  },

  init: async () => {
    if (window.api) {
      const dbConnected = await window.api.getDbStatus();
      set({ dbStatus: dbConnected });
      if (dbConnected) {
        await get().loadSettings();
        await get().checkSemanticIndexStatus();
        await Promise.all([
          get().fetchPrompts(),
          get().fetchCategories(),
          get().fetchCollections(),
          get().fetchTags(),
        ]);
      }
    }
  },

  fetchPrompts: async () => {
    if (!window.api) return;
    
    // If semantic mode is enabled and query is present, query semanticSearch endpoint
    if (get().isSemanticMode && get().searchQuery.trim().length > 0) {
      const results = await window.api.semanticSearch(get().searchQuery, get().embeddingModel);
      
      // Apply local filters in memory
      let filtered = results;
      if (get().onlyFavorites) {
        filtered = filtered.filter(p => p.isFavorite);
      }
      if (get().selectedCategoryId !== undefined) {
        filtered = filtered.filter(p => p.categoryId === get().selectedCategoryId);
      }

      const promptsWithFav = await Promise.all(filtered.map(async (p: Prompt) => {
        const isFav = await window.api!.isFavorite(p.id);
        return { ...p, isFavorite: isFav };
      }));

      set({ prompts: promptsWithFav });
      return;
    }

    // Default Keyword Search
    const filter = {
      isArchived: get().showArchived,
      categoryId: get().selectedCategoryId,
      collectionId: get().selectedCollectionId || undefined,
      tagId: get().selectedTagId || undefined,
      keyword: get().searchQuery || undefined,
      onlyFavorites: get().onlyFavorites || undefined,
    };
    const prompts = await window.api.listPrompts(filter);
    
    const promptsWithFav = await Promise.all(prompts.map(async (p: Prompt) => {
      const isFav = await window.api!.isFavorite(p.id);
      return { ...p, isFavorite: isFav };
    }));

    set({ prompts: promptsWithFav });
  },

  fetchCategories: async () => {
    if (!window.api) return;
    const categories = await window.api.listCategories();
    set({ categories });
  },

  fetchCollections: async () => {
    if (!window.api) return;
    const collections = await window.api.listCollections();
    set({ collections });
  },

  fetchTags: async () => {
    if (!window.api) return;
    const tags = await window.api.listTags();
    set({ tags });
  },

  selectPrompt: async (id) => {
    if (!window.api) return;
    if (id === null) {
      set({ activePromptId: null, activePrompt: null });
      return;
    }

    const details = await window.api.getPrompt(id);
    if (details) {
      const isFav = await window.api.isFavorite(id);
      details.prompt.isFavorite = isFav;
      set({ activePromptId: id, activePrompt: details });
    }
  },

  createPrompt: async (title, content, description, categoryId, tags) => {
    if (!window.api) return;
    const id = `prompt_${Date.now()}`;
    const newPrompt = await window.api.createPrompt({
      id,
      title,
      description,
      content,
      categoryId,
      notes: '',
      tags: tags.map(t => ({ id: t.id, name: t.name })),
    });

    await get().fetchPrompts();
    await get().fetchTags();
    await get().checkSemanticIndexStatus(); // Update status counts
    await get().selectPrompt(newPrompt.id);
  },

  updatePrompt: async (id, updates) => {
    if (!window.api) return;
    
    await window.api.updatePrompt({
      id,
      title: updates.title,
      description: updates.description,
      content: updates.content,
      changeDescription: updates.changeDescription,
      categoryId: updates.categoryId,
      notes: updates.notes,
      tags: updates.tags.map(t => ({ id: t.id, name: t.name })),
    });

    await get().fetchPrompts();
    await get().fetchTags();
    await get().checkSemanticIndexStatus();
    await get().selectPrompt(id);
  },

  deletePrompt: async (id) => {
    if (!window.api) return;
    const success = await window.api.deletePrompt(id);
    if (success) {
      const activeId = get().activePromptId;
      set({ activePromptId: activeId === id ? null : activeId, activePrompt: activeId === id ? null : get().activePrompt });
      await get().fetchPrompts();
      await get().checkSemanticIndexStatus();
    }
  },

  toggleFavorite: async (id) => {
    if (!window.api) return;
    const isFav = await window.api.isFavorite(id);
    if (isFav) {
      await window.api.removeFavorite(id);
    } else {
      await window.api.addFavorite(id);
    }

    const active = get().activePrompt;
    if (active && active.prompt.id === id) {
      set({
        activePrompt: {
          ...active,
          prompt: { ...active.prompt, isFavorite: !isFav }
        }
      });
    }

    await get().fetchPrompts();
  },

  createCategory: async (name, parentId = null) => {
    if (!window.api) return;
    const id = `cat_${Date.now()}`;
    await window.api.createCategory({ id, name, parentId });
    await get().fetchCategories();
  },

  deleteCategory: async (id) => {
    if (!window.api) return;
    await window.api.deleteCategory(id);
    await get().fetchCategories();
    await get().fetchPrompts();
  },

  createCollection: async (name, description = '') => {
    if (!window.api) return;
    const id = `col_${Date.now()}`;
    await window.api.createCollection({ id, name, description });
    await get().fetchCollections();
  },

  deleteCollection: async (id) => {
    if (!window.api) return;
    await window.api.deleteCollection(id);
    await get().fetchCollections();
    await get().fetchPrompts();
  },

  addPromptToCollection: async (promptId, collectionId) => {
    if (!window.api) return;
    await window.api.addPromptToCollection(promptId, collectionId);
    if (get().activePromptId === promptId) {
      await get().selectPrompt(promptId);
    }
  },

  removePromptFromCollection: async (promptId, collectionId) => {
    if (!window.api) return;
    await window.api.removePromptFromCollection(promptId, collectionId);
    if (get().activePromptId === promptId) {
      await get().selectPrompt(promptId);
    }
  },

  exportPrompt: async (id, format) => {
    if (!window.api) return false;
    return window.api.exportPrompt(id, format);
  },

  importPrompt: async () => {
    if (!window.api) return false;
    const success = await window.api.importPrompt();
    if (success) {
      await get().fetchPrompts();
      await get().fetchCategories();
      await get().fetchTags();
      await get().checkSemanticIndexStatus();
    }
    return success;
  },

  restoreVersion: async (promptId, versionNumber, content) => {
    if (!window.api) return;
    const active = get().activePrompt;
    if (!active) return;
    await window.api.updatePrompt({
      id: promptId,
      title: active.prompt.title,
      description: active.prompt.description,
      content,
      changeDescription: `Restored version ${versionNumber}`,
      categoryId: active.prompt.categoryId,
      notes: active.prompt.notes,
      tags: active.prompt.tags
    });
    await get().fetchPrompts();
    await get().selectPrompt(promptId);
  },

  setIsSemanticMode: (val) => {
    set({ isSemanticMode: val });
    get().fetchPrompts();
  },

  checkSemanticIndexStatus: async () => {
    if (!window.api) return;
    const status = await window.api.checkSemanticStatus(get().embeddingModel);
    set({ searchStaleStatus: status });
  },

  rebuildSemanticIndex: async () => {
    if (!window.api) return;
    set({ isRebuildingIndex: true, rebuildPercent: 0 });
    
    const unsub = window.api.onSemanticProgress((data) => {
      set({ rebuildPercent: data.percent });
    });

    await window.api.rebuildSemanticIndex(get().embeddingModel);
    unsub();

    set({ isRebuildingIndex: false, rebuildPercent: 100 });
    await get().checkSemanticIndexStatus();
    await get().fetchPrompts();
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
    get().fetchPrompts();
  },

  setSelectedCategoryId: (categoryId) => {
    set({ selectedCategoryId: categoryId });
    get().fetchPrompts();
  },

  setSelectedCollectionId: (collectionId) => {
    set({ selectedCollectionId: collectionId });
    get().fetchPrompts();
  },

  setSelectedTagId: (tagId) => {
    set({ selectedTagId: tagId });
    get().fetchPrompts();
  },

  setOnlyFavorites: (onlyFavs) => {
    set({ onlyFavorites: onlyFavs });
    get().fetchPrompts();
  },

  setShowArchived: (showArchived) => {
    set({ showArchived });
    get().fetchPrompts();
  },
}));
