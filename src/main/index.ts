import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { initDatabase, getDb, isDbConnected } from './db';

// Repositories
import { SqlitePromptRepository } from '../core/infrastructure/database/SqlitePromptRepository';
import { SqliteSettingsRepository } from '../core/infrastructure/database/SqliteSettingsRepository';

// Services & Indexers
import { OllamaService } from '../core/infrastructure/ollama/OllamaService';
import { SemanticSearchIndex } from './semanticSearch';

// Use Cases
import { CreatePrompt } from '../core/application/prompt/CreatePrompt';
import { UpdatePrompt } from '../core/application/prompt/UpdatePrompt';
import { GetPromptDetails } from '../core/application/prompt/GetPromptDetails';
import { ListPrompts } from '../core/application/prompt/ListPrompts';
import { ManageCategories, ManageCollections, ManageFavorites } from '../core/application/prompt/OrganizationUseCases';
import { ExportPrompt } from '../core/application/prompt/ExportPrompt';
import { ImportPrompt } from '../core/application/prompt/ImportPrompt';
import { SuggestMetadata } from '../core/application/ai/SuggestMetadata';
import { ImprovePrompt } from '../core/application/ai/ImprovePrompt';
import { DetectDuplicate } from '../core/application/ai/DetectDuplicate';
import { GeneratePrompt } from '../core/application/ai/GeneratePrompt';

let mainWindow: BrowserWindow | null = null;
const semanticIndex = new SemanticSearchIndex();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#090d16',
    title: 'PromptFlow',
  });

  mainWindow.setMenu(null);

  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function bootstrapIpc() {
  const db = getDb();
  const promptRepo = new SqlitePromptRepository(db);
  const settingsRepo = new SqliteSettingsRepository(db);
  
  // Initialize AI Services & Search Cache
  const aiService = new OllamaService();
  semanticIndex.initialize(promptRepo);

  // Instantiating Interactors
  const createPromptUseCase = new CreatePrompt(promptRepo);
  const updatePromptUseCase = new UpdatePrompt(promptRepo);
  const getPromptDetailsUseCase = new GetPromptDetails(promptRepo);
  const listPromptsUseCase = new ListPrompts(promptRepo);
  const manageCategories = new ManageCategories(promptRepo);
  const manageCollections = new ManageCollections(promptRepo);
  const manageFavorites = new ManageFavorites(promptRepo);
  const exportPromptUseCase = new ExportPrompt();
  const importPromptUseCase = new ImportPrompt(promptRepo);
  
  const suggestMetadataUseCase = new SuggestMetadata(aiService);
  const improvePromptUseCase = new ImprovePrompt(aiService);
  const detectDuplicateUseCase = new DetectDuplicate(promptRepo, aiService);
  const generatePromptUseCase = new GeneratePrompt(aiService);

  // Register Handlers
  ipcMain.handle('db:status', async () => {
    return isDbConnected();
  });

  // Settings Operations
  ipcMain.handle('settings:get', async (_, key) => {
    const settings = await settingsRepo.getSettings();
    if (key === 'metadataModel') return settings.defaultPromptModel;
    if (key === 'improveModel') return settings.defaultCodeModel;
    if (key === 'embeddingModel') return settings.defaultEmbeddingModel;
    if (key === 'ollamaEndpoint') return settings.ollamaEndpoint;
    return null;
  });

  ipcMain.handle('settings:set', async (_, { key, value }) => {
    const settings = await settingsRepo.getSettings();
    if (key === 'metadataModel') settings.defaultPromptModel = value;
    if (key === 'improveModel') settings.defaultCodeModel = value;
    if (key === 'embeddingModel') settings.defaultEmbeddingModel = value;
    if (key === 'ollamaEndpoint') settings.ollamaEndpoint = value;
    await settingsRepo.saveSettings(settings);
    return true;
  });

  // AI Operations
  ipcMain.handle('ai:status', async () => {
    return aiService.isOnline();
  });

  ipcMain.handle('ai:get-models', async () => {
    return aiService.getModels();
  });

  ipcMain.handle('ai:suggest-metadata', async (_, { content, model }) => {
    return suggestMetadataUseCase.execute(content, model);
  });

  ipcMain.handle('ai:improve-prompt', async (_, { content, action, model }) => {
    return improvePromptUseCase.execute(content, action, model);
  });

  ipcMain.handle('ai:detect-duplicate', async (_, { title, content, model }) => {
    return detectDuplicateUseCase.execute(title, content, model);
  });

  ipcMain.handle('ai:generate-prompt', async (_, { requirement, model }) => {
    return generatePromptUseCase.execute(requirement, model);
  });

  // Playground concurrent stream execution
  ipcMain.handle('playground:run', async (_, { compiledPrompt, models, executionId, promptId }) => {
    models.forEach((model: string) => {
      let accumulatedText = '';
      
      aiService.generateStream(compiledPrompt, model, (chunkText) => {
        accumulatedText += chunkText;
        mainWindow?.webContents.send('playground:chunk', {
          executionId,
          model,
          text: chunkText,
          done: false
        });
      })
      .then(() => {
        mainWindow?.webContents.send('playground:chunk', {
          executionId,
          model,
          text: '',
          done: true
        });

        // Save execution to SQLite log storage (Milestone 6)
        try {
          db.prepare(`
            INSERT INTO playground_history (id, prompt_id, compiled_prompt, model, response)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            `${executionId}_${model}`,
            promptId || null,
            compiledPrompt,
            model,
            accumulatedText
          );
        } catch (err) {
          console.error('Failed to save playground log:', err);
        }
      })
      .catch((err) => {
        console.error(`Playground stream error for model ${model}:`, err);
        mainWindow?.webContents.send('playground:chunk', {
          executionId,
          model,
          text: `\n[Execution Error: ${err.message}]`,
          done: true
        });
      });
    });
    return true;
  });

  ipcMain.handle('playground:get-history', async (_, promptId) => {
    try {
      const rows = db.prepare(`
        SELECT * FROM playground_history 
        WHERE prompt_id = ? 
        ORDER BY created_at DESC 
        LIMIT 10
      `).all(promptId);
      return rows.map((r: any) => ({
        id: r.id,
        promptId: r.prompt_id,
        compiledPrompt: r.compiled_prompt,
        model: r.model,
        response: r.response,
        createdAt: r.created_at
      }));
    } catch {
      return [];
    }
  });

  // Semantic Search & Rebuilding Operations
  ipcMain.handle('semantic:check-status', async (_, targetModel) => {
    return semanticIndex.checkIndexStatus(promptRepo, targetModel);
  });

  ipcMain.handle('semantic:rebuild', async (_, targetModel) => {
    return semanticIndex.rebuild(promptRepo, aiService, targetModel, (percent, current, total) => {
      mainWindow?.webContents.send('semantic:rebuild-progress', { percent, current, total });
    });
  });

  ipcMain.handle('semantic:search', async (_, { query, targetModel, limit }) => {
    try {
      const online = await aiService.isOnline();
      if (!online) return [];

      const queryVector = await aiService.embed(query, targetModel);
      if (queryVector.length === 0) return [];

      const matches = semanticIndex.search(queryVector, targetModel, limit || 5);
      
      // Map prompt ids back to full prompt records from DB
      const promptsList = await Promise.all(
        matches.map(async (m) => {
          const details = await getPromptDetailsUseCase.execute(m.promptId);
          if (details) {
            // Attach similarity score
            return {
              ...details.prompt,
              similarity: m.similarity
            };
          }
          return null;
        })
      );

      return promptsList.filter(Boolean);
    } catch (err) {
      console.error('Semantic search error:', err);
      return [];
    }
  });

  // Prompt Operations
  ipcMain.handle('prompts:create', async (_, input) => {
    const prompt = await createPromptUseCase.execute(input);
    
    // Asynchronously generate vector embedding in background
    (async () => {
      try {
        const settings = await settingsRepo.getSettings();
        const model = settings.defaultEmbeddingModel || 'embeddinggemma';
        const online = await aiService.isOnline();
        if (online) {
          const vector = await aiService.embed(input.content, model);
          if (vector.length > 0) {
            const floatArray = new Float32Array(vector);
            const versionId = `${prompt.id}_v1`;
            await promptRepo.saveVersionEmbedding(versionId, floatArray, model);
            semanticIndex.updateVersion(prompt.id, versionId, floatArray, model);
          }
        }
      } catch (err) {
        console.error('Failed to generate save embedding:', err);
      }
    })();

    return prompt;
  });

  ipcMain.handle('prompts:update', async (_, input) => {
    const prompt = await updatePromptUseCase.execute(input);
    
    // Asynchronously generate vector embedding in background if content changed
    (async () => {
      try {
        if (input.content !== undefined) {
          const settings = await settingsRepo.getSettings();
          const model = settings.defaultEmbeddingModel || 'embeddinggemma';
          const online = await aiService.isOnline();
          if (online) {
            const details = await getPromptDetailsUseCase.execute(input.id);
            if (details && details.latestVersion) {
              const v = details.latestVersion;
              const vector = await aiService.embed(v.content, model);
              if (vector.length > 0) {
                const floatArray = new Float32Array(vector);
                await promptRepo.saveVersionEmbedding(v.id, floatArray, model);
                semanticIndex.updateVersion(input.id, v.id, floatArray, model);
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to generate update embedding:', err);
      }
    })();

    return prompt;
  });

  ipcMain.handle('prompts:get', async (_, id) => {
    return getPromptDetailsUseCase.execute(id);
  });

  ipcMain.handle('prompts:delete', async (_, id) => {
    const success = await promptRepo.deletePrompt(id);
    if (success) {
      semanticIndex.removePrompt(id);
    }
    return success;
  });

  ipcMain.handle('prompts:list', async (_, filter) => {
    return listPromptsUseCase.execute(filter);
  });

  // Import/Export Operations
  ipcMain.handle('prompts:export', async (_, { id, format }) => {
    if (!mainWindow) return false;
    
    const details = await getPromptDetailsUseCase.execute(id);
    if (!details) return false;

    const result = exportPromptUseCase.execute(details as any, format);
    
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Prompt Template',
      defaultPath: `${result.filename}.${result.extension}`,
      filters: [
        { name: format === 'json' ? 'JSON File' : 'Markdown File', extensions: [result.extension] }
      ]
    });

    if (filePath) {
      fs.writeFileSync(filePath, result.content, 'utf-8');
      return true;
    }
    return false;
  });

  ipcMain.handle('prompts:import', async () => {
    if (!mainWindow) return false;

    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Prompt File',
      properties: ['openFile'],
      filters: [
        { name: 'Supported Formats (.md, .txt, .json)', extensions: ['md', 'txt', 'json'] }
      ]
    });

    if (filePaths && filePaths.length > 0) {
      const selectedPath = filePaths[0];
      const rawContent = fs.readFileSync(selectedPath, 'utf-8');
      const ext = path.extname(selectedPath);
      
      const success = await importPromptUseCase.execute(rawContent, ext);
      if (success) {
        // Asynchronously update all newly imported vectors
        (async () => {
          try {
            const settings = await settingsRepo.getSettings();
            const model = settings.defaultEmbeddingModel || 'embeddinggemma';
            const online = await aiService.isOnline();
            if (online) {
              const versions = await promptRepo.listAllVersions();
              const missingEmbeds = versions.filter(v => v.embedding === null);
              for (const v of missingEmbeds) {
                const vector = await aiService.embed(v.content, model);
                if (vector.length > 0) {
                  const floatArray = new Float32Array(vector);
                  await promptRepo.saveVersionEmbedding(v.id, floatArray, model);
                  semanticIndex.updateVersion(v.promptId, v.id, floatArray, model);
                }
              }
            }
          } catch (err) {
            console.error('Failed to generate imported embeddings:', err);
          }
        })();
      }
      return success;
    }
    return false;
  });

  // Category Operations
  ipcMain.handle('categories:create', async (_, { id, name, parentId }) => {
    return manageCategories.create(id, name, parentId);
  });

  ipcMain.handle('categories:list', async () => {
    return manageCategories.list();
  });

  ipcMain.handle('categories:delete', async (_, id) => {
    return manageCategories.delete(id);
  });

  // Collection Operations
  ipcMain.handle('collections:create', async (_, { id, name, description }) => {
    return manageCollections.create(id, name, description);
  });

  ipcMain.handle('collections:list', async () => {
    return manageCollections.list();
  });

  ipcMain.handle('collections:delete', async (_, id) => {
    return manageCollections.delete(id);
  });

  ipcMain.handle('collections:add-prompt', async (_, { promptId, collectionId }) => {
    return manageCollections.addPrompt(promptId, collectionId);
  });

  ipcMain.handle('collections:remove-prompt', async (_, { promptId, collectionId }) => {
    return manageCollections.removePrompt(promptId, collectionId);
  });

  // Favorite Operations
  ipcMain.handle('favorites:add', async (_, promptId) => {
    return manageFavorites.add(promptId);
  });

  ipcMain.handle('favorites:remove', async (_, promptId) => {
    return manageFavorites.remove(promptId);
  });

  // Checks
  ipcMain.handle('favorites:is', async (_, promptId) => {
    return manageFavorites.isFavorite(promptId);
  });

  ipcMain.handle('favorites:list', async () => {
    return manageFavorites.list();
  });

  // Tags Operations
  ipcMain.handle('tags:list', async () => {
    return promptRepo.listTags();
  });
}

// App Lifecycle
app.whenReady().then(() => {
  const dbStatus = initDatabase();
  
  if (dbStatus) {
    bootstrapIpc();
  } else {
    console.error('Failed to bootstrap IPC handlers due to database connection error.');
    ipcMain.handle('db:status', () => false);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
