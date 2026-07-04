export interface Tag {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
}

export interface PromptVersion {
  id: string;
  promptId: string;
  versionNumber: number;
  content: string;
  changeDescription: string;
  embeddingModel: string | null;
  createdAt: string;
}

export interface Prompt {
  id: string;
  title: string;
  description: string;
  categoryId: string | null;
  notes: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
  isFavorite?: boolean;
  similarity?: number;
}

export interface PromptDetails {
  prompt: Prompt;
  latestVersion: PromptVersion;
  versions: PromptVersion[];
  collections: Collection[];
}
