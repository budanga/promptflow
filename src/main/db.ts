import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

let db: Database.Database | null = null;

export function initDatabase(): boolean {
  try {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'promptflow.db');
    
    // Ensure the userData directory exists
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    db = new Database(dbPath, { verbose: console.log });

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Run schema migrations/initialization
    db.exec(`
      -- Categories (Hierarchical organization)
      CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          parent_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
      );

      -- Collections (Prompts can belong to multiple collections)
      CREATE TABLE IF NOT EXISTS collections (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Prompts (Main metadata)
      CREATE TABLE IF NOT EXISTS prompts (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          category_id TEXT,
          notes TEXT,
          is_archived INTEGER DEFAULT 0 CHECK(is_archived IN (0, 1)),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      );

      -- Prompt Versions (Saves complete content history)
      CREATE TABLE IF NOT EXISTS prompt_versions (
          id TEXT PRIMARY KEY,
          prompt_id TEXT NOT NULL,
          version_number INTEGER NOT NULL,
          content TEXT NOT NULL,
          change_description TEXT,
          embedding BLOB, -- 1024-dimension float vector
          embedding_model TEXT, -- Stores name & version of the model used
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
          UNIQUE(prompt_id, version_number)
      );

      -- Tags
      CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE
      );

      -- Junction table for Prompts and Tags
      CREATE TABLE IF NOT EXISTS prompt_tags (
          prompt_id TEXT NOT NULL,
          tag_id TEXT NOT NULL,
          PRIMARY KEY (prompt_id, tag_id),
          FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );

      -- Junction table for Prompts and Collections
      CREATE TABLE IF NOT EXISTS prompt_collections (
          prompt_id TEXT NOT NULL,
          collection_id TEXT NOT NULL,
          PRIMARY KEY (prompt_id, collection_id),
          FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
          FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
      );

      -- Saved Variables (Global pool / reusable variables)
      CREATE TABLE IF NOT EXISTS variables (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          default_value TEXT
      );

      -- Favorites (Explicit list for quick access)
      CREATE TABLE IF NOT EXISTS favorites (
          prompt_id TEXT PRIMARY KEY,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
      );

      -- Semantic Search History
      CREATE TABLE IF NOT EXISTS search_history (
          id TEXT PRIMARY KEY,
          query TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Key-Value Settings Storage
      CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
      );

      -- Playground Execution History Logs
      CREATE TABLE IF NOT EXISTS playground_history (
          id TEXT PRIMARY KEY,
          prompt_id TEXT,
          compiled_prompt TEXT NOT NULL,
          model TEXT NOT NULL,
          response TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log(`Database initialized successfully at: ${dbPath}`);
    return true;
  } catch (error) {
    console.error('Failed to initialize SQLite database:', error);
    return false;
  }
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return db;
}

export function isDbConnected(): boolean {
  return db !== null;
}
