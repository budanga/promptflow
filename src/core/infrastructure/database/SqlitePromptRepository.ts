import Database from 'better-sqlite3';
import { IPromptRepository, PromptListFilter } from '../../domain/repositories/IPromptRepository';
import { Prompt } from '../../domain/entities/Prompt';
import { PromptVersion } from '../../domain/entities/PromptVersion';
import { Category } from '../../domain/entities/Category';
import { Collection } from '../../domain/entities/Collection';
import { Tag } from '../../domain/entities/Tag';

export class SqlitePromptRepository implements IPromptRepository {
  constructor(private db: Database.Database) {}

  // Prompt CRUD
  async createPrompt(prompt: Prompt, initialContent: string): Promise<Prompt> {
    const createTx = this.db.transaction(() => {
      // 1. Insert prompt
      this.db.prepare(`
        INSERT INTO prompts (id, title, description, category_id, notes, is_archived, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        prompt.id,
        prompt.title,
        prompt.description,
        prompt.categoryId,
        prompt.notes,
        prompt.isArchived ? 1 : 0,
        prompt.createdAt.toISOString(),
        prompt.updatedAt.toISOString()
      );

      // 2. Insert initial version
      const versionId = `${prompt.id}_v1`;
      this.db.prepare(`
        INSERT INTO prompt_versions (id, prompt_id, version_number, content, change_description, embedding, embedding_model, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        versionId,
        prompt.id,
        1,
        initialContent,
        'Initial version',
        null,
        null,
        prompt.createdAt.toISOString()
      );

      // 3. Insert tags junctions if provided
      if (prompt.tags && prompt.tags.length > 0) {
        const insertTagJunction = this.db.prepare(`
          INSERT OR IGNORE INTO prompt_tags (prompt_id, tag_id) VALUES (?, ?)
        `);
        for (const tag of prompt.tags) {
          // Tag must already exist or we ignore
          insertTagJunction.run(prompt.id, tag.id);
        }
      }
    });

    createTx();
    return prompt;
  }

  async getPromptById(id: string): Promise<{ prompt: Prompt; latestVersion: PromptVersion; versions: PromptVersion[] } | null> {
    const promptRow: any = this.db.prepare('SELECT * FROM prompts WHERE id = ?').get(id);
    if (!promptRow) return null;

    // Load category if exists
    let category: Category | null = null;
    if (promptRow.category_id) {
      const catRow: any = this.db.prepare('SELECT * FROM categories WHERE id = ?').get(promptRow.category_id);
      if (catRow) {
        category = new Category(catRow.id, catRow.name, catRow.parent_id, new Date(catRow.created_at));
      }
    }

    // Load tags
    const tagRows: any[] = this.db.prepare(`
      SELECT t.* FROM tags t
      JOIN prompt_tags pt ON t.id = pt.tag_id
      WHERE pt.prompt_id = ?
    `).all(id);
    const tags = tagRows.map(row => new Tag(row.id, row.name));

    const prompt = new Prompt(
      promptRow.id,
      promptRow.title,
      promptRow.description,
      promptRow.category_id,
      promptRow.notes,
      promptRow.is_archived === 1,
      new Date(promptRow.created_at),
      new Date(promptRow.updated_at),
      tags,
      category
    );

    // Load versions
    const versionRows: any[] = this.db.prepare('SELECT * FROM prompt_versions WHERE prompt_id = ? ORDER BY version_number ASC').all(id);
    const versions = versionRows.map(row => new PromptVersion(
      row.id,
      row.prompt_id,
      row.version_number,
      row.content,
      row.change_description,
      row.embedding ? new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / Float32Array.BYTES_PER_ELEMENT) : null,
      row.embedding_model,
      new Date(row.created_at)
    ));

    const latestVersion = versions[versions.length - 1];

    return { prompt, latestVersion, versions };
  }

  async saveVersionEmbedding(versionId: string, embedding: Float32Array, model: string): Promise<boolean> {
    try {
      const buffer = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);
      const res = this.db.prepare(`
        UPDATE prompt_versions
        SET embedding = ?, embedding_model = ?
        WHERE id = ?
      `).run(buffer, model, versionId);
      return res.changes > 0;
    } catch (error) {
      console.error('Failed to save version embedding to SQLite:', error);
      return false;
    }
  }

  async listAllVersions(): Promise<PromptVersion[]> {
    try {
      const rows = this.db.prepare('SELECT * FROM prompt_versions').all();
      return rows.map((row: any) => new PromptVersion(
        row.id,
        row.prompt_id,
        row.version_number,
        row.content,
        row.change_description,
        row.embedding ? new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / Float32Array.BYTES_PER_ELEMENT) : null,
        row.embedding_model,
        new Date(row.created_at)
      ));
    } catch (error) {
      console.error('Failed to list all prompt versions:', error);
      return [];
    }
  }

  async updatePrompt(prompt: Prompt, newContent?: string, changeDescription?: string): Promise<Prompt> {
    const updateTx = this.db.transaction(() => {
      const updatedAt = new Date();
      
      // 1. Update metadata
      this.db.prepare(`
        UPDATE prompts
        SET title = ?, description = ?, category_id = ?, notes = ?, is_archived = ?, updated_at = ?
        WHERE id = ?
      `).run(
        prompt.title,
        prompt.description,
        prompt.categoryId,
        prompt.notes,
        prompt.isArchived ? 1 : 0,
        updatedAt.toISOString(),
        prompt.id
      );

      prompt.updatedAt = updatedAt;

      // 2. Insert new version if new content is supplied
      if (newContent !== undefined) {
        const latestVersionRow: any = this.db.prepare(`
          SELECT MAX(version_number) as max_v FROM prompt_versions WHERE prompt_id = ?
        `).get(prompt.id);
        
        const nextVersionNum = (latestVersionRow?.max_v || 0) + 1;
        const versionId = `${prompt.id}_v${nextVersionNum}`;

        this.db.prepare(`
          INSERT INTO prompt_versions (id, prompt_id, version_number, content, change_description, embedding, embedding_model, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          versionId,
          prompt.id,
          nextVersionNum,
          newContent,
          changeDescription || `Updated to version ${nextVersionNum}`,
          null,
          null,
          updatedAt.toISOString()
        );
      }
    });

    updateTx();
    return prompt;
  }

  async deletePrompt(id: string): Promise<boolean> {
    const res = this.db.prepare('DELETE FROM prompts WHERE id = ?').run(id);
    return res.changes > 0;
  }

  async listPrompts(filter?: PromptListFilter): Promise<Prompt[]> {
    let query = `
      SELECT p.*, f.prompt_id IS NOT NULL as is_favorite
      FROM prompts p
      LEFT JOIN favorites f ON p.id = f.prompt_id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    // Filter by archive state
    if (filter?.isArchived !== undefined) {
      conditions.push('p.is_archived = ?');
      params.push(filter.isArchived ? 1 : 0);
    } else {
      conditions.push('p.is_archived = 0');
    }

    // Filter by Category
    if (filter?.categoryId !== undefined) {
      if (filter.categoryId === null) {
        conditions.push('p.category_id IS NULL');
      } else {
        conditions.push('p.category_id = ?');
        params.push(filter.categoryId);
      }
    }

    // Filter by Collection
    if (filter?.collectionId) {
      conditions.push('p.id IN (SELECT prompt_id FROM prompt_collections WHERE collection_id = ?)');
      params.push(filter.collectionId);
    }

    // Filter by Tag
    if (filter?.tagId) {
      conditions.push('p.id IN (SELECT prompt_id FROM prompt_tags WHERE tag_id = ?)');
      params.push(filter.tagId);
    }

    // Filter by Favorites
    if (filter?.onlyFavorites) {
      conditions.push('f.prompt_id IS NOT NULL');
    }

    // Keyword search
    if (filter?.keyword) {
      conditions.push('(p.title LIKE ? OR p.description LIKE ? OR p.notes LIKE ? OR p.id IN (SELECT prompt_id FROM prompt_versions WHERE content LIKE ?))');
      const term = `%${filter.keyword}%`;
      params.push(term, term, term, term);
    }

    // Assemble query conditions
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY p.updated_at DESC';

    const rows = this.db.prepare(query).all(...params);
    const prompts: Prompt[] = [];

    for (const row of rows as any[]) {
      // Load tags for each prompt
      const tagRows: any[] = this.db.prepare(`
        SELECT t.* FROM tags t
        JOIN prompt_tags pt ON t.id = pt.tag_id
        WHERE pt.prompt_id = ?
      `).all(row.id);
      const tags = tagRows.map(tRow => new Tag(tRow.id, tRow.name));

      prompts.push(new Prompt(
        row.id,
        row.title,
        row.description,
        row.category_id,
        row.notes,
        row.is_archived === 1,
        new Date(row.created_at),
        new Date(row.updated_at),
        tags
      ));
    }

    return prompts;
  }

  // Categories (Folders)
  async createCategory(category: Category): Promise<Category> {
    this.db.prepare(`
      INSERT INTO categories (id, name, parent_id, created_at)
      VALUES (?, ?, ?, ?)
    `).run(category.id, category.name, category.parentId, category.createdAt.toISOString());
    return category;
  }

  async listCategories(): Promise<Category[]> {
    const rows = this.db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
    return rows.map((row: any) => new Category(
      row.id,
      row.name,
      row.parent_id,
      new Date(row.created_at)
    ));
  }

  async deleteCategory(id: string): Promise<boolean> {
    const res = this.db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    return res.changes > 0;
  }

  // Collections
  async createCollection(collection: Collection): Promise<Collection> {
    this.db.prepare(`
      INSERT INTO collections (id, name, description, created_at)
      VALUES (?, ?, ?, ?)
    `).run(collection.id, collection.name, collection.description, collection.createdAt.toISOString());
    return collection;
  }

  async listCollections(): Promise<Collection[]> {
    const rows = this.db.prepare('SELECT * FROM collections ORDER BY name ASC').all();
    return rows.map((row: any) => new Collection(
      row.id,
      row.name,
      row.description,
      new Date(row.created_at)
    ));
  }

  async deleteCollection(id: string): Promise<boolean> {
    const res = this.db.prepare('DELETE FROM collections WHERE id = ?').run(id);
    return res.changes > 0;
  }

  async addPromptToCollection(promptId: string, collectionId: string): Promise<boolean> {
    const res = this.db.prepare(`
      INSERT OR IGNORE INTO prompt_collections (prompt_id, collection_id)
      VALUES (?, ?)
    `).run(promptId, collectionId);
    return res.changes > 0;
  }

  async removePromptFromCollection(promptId: string, collectionId: string): Promise<boolean> {
    const res = this.db.prepare(`
      DELETE FROM prompt_collections WHERE prompt_id = ? AND collection_id = ?
    `).run(promptId, collectionId);
    return res.changes > 0;
  }

  async getCollectionsByPromptId(promptId: string): Promise<Collection[]> {
    const rows = this.db.prepare(`
      SELECT c.* FROM collections c
      JOIN prompt_collections pc ON c.id = pc.collection_id
      WHERE pc.prompt_id = ?
    `).all(promptId);
    return rows.map((row: any) => new Collection(
      row.id,
      row.name,
      row.description,
      new Date(row.created_at)
    ));
  }

  // Tags
  async createTag(tag: Tag): Promise<Tag> {
    this.db.prepare(`
      INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)
    `).run(tag.id, tag.name);
    return tag;
  }

  async listTags(): Promise<Tag[]> {
    const rows = this.db.prepare('SELECT * FROM tags ORDER BY name ASC').all();
    return rows.map((row: any) => new Tag(row.id, row.name));
  }

  async addTagToPrompt(promptId: string, tagId: string): Promise<boolean> {
    const res = this.db.prepare(`
      INSERT OR IGNORE INTO prompt_tags (prompt_id, tag_id) VALUES (?, ?)
    `).run(promptId, tagId);
    return res.changes > 0;
  }

  async removeTagFromPrompt(promptId: string, tagId: string): Promise<boolean> {
    const res = this.db.prepare(`
      DELETE FROM prompt_tags WHERE prompt_id = ? AND tag_id = ?
    `).run(promptId, tagId);
    return res.changes > 0;
  }

  // Favorites
  async addFavorite(promptId: string): Promise<boolean> {
    const res = this.db.prepare('INSERT OR IGNORE INTO favorites (prompt_id) VALUES (?)').run(promptId);
    return res.changes > 0;
  }

  async removeFavorite(promptId: string): Promise<boolean> {
    const res = this.db.prepare('DELETE FROM favorites WHERE prompt_id = ?').run(promptId);
    return res.changes > 0;
  }

  async isFavorite(promptId: string): Promise<boolean> {
    const row = this.db.prepare('SELECT 1 FROM favorites WHERE prompt_id = ?').get(promptId);
    return row !== undefined;
  }

  async listFavorites(): Promise<Prompt[]> {
    return this.listPrompts({ onlyFavorites: true });
  }
}
