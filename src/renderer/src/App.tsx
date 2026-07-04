import { useEffect, useState, useRef } from 'react';
import { usePromptStore, Tag } from './store/promptStore';
import { computeLineDiff } from './utils/diff';
import { extractVariables, compileTemplate } from './utils/variables';
import { analyzePromptQuality } from './utils/quality';

// Pure inline SVG icons for 100% offline compatibility
const Icons = {
  Terminal: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Add: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  ),
  Folder: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  FolderOpen: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6" />
    </svg>
  ),
  StarFilled: () => (
    <svg className="w-5 h-5 text-amber-400 fill-amber-400" viewBox="0 0 20 20" fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  ),
  StarOutlined: () => (
    <svg className="w-5 h-5 text-slate-400 hover:text-amber-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  Collections: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  Tag: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
    </svg>
  ),
  Search: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  Settings: () => (
    <svg className="w-4 h-4 text-slate-400 hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Delete: () => (
    <svg className="w-5 h-5 text-slate-400 hover:text-rose-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  Copy: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
    </svg>
  ),
  Play: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Sparkles: () => (
    <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  Export: () => (
    <svg className="w-5 h-5 text-slate-400 hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  Import: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  History: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
};

function App() {
  const store = usePromptStore();
  const [ollamaStatus, setOllamaStatus] = useState<'connected' | 'offline'>('offline');

  // Active editor tabs: 'editor' | 'variables' | 'playground' | 'history'
  const [activeTab, setActiveTab] = useState<'editor' | 'variables' | 'playground' | 'history'>('editor');

  // Local Form state for active editing/creating
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Quality Analyzer state
  const [showQualityPanel, setShowQualityPanel] = useState(false);

  // Session ID to cancel/discard background AI suggestions when switching prompts
  const currentSessionId = useRef(0);

  // Variables state
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [copySuccess, setCopySuccess] = useState(false);

  // History & Diff state
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);

  // Playground States (Milestone 6)
  const [playgroundModels, setPlaygroundModels] = useState<string[]>([]);
  const [playgroundOutputs, setPlaygroundOutputs] = useState<Record<string, string>>({});
  const [playgroundStatuses, setPlaygroundStatuses] = useState<Record<string, 'idle' | 'streaming' | 'done' | 'error'>>({});
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);
  const [playgroundHistory, setPlaygroundHistory] = useState<any[]>([]);
  const [showPlaygroundHistory, setShowPlaygroundHistory] = useState(false);

  // Dropdown menu state
  const [showExportMenu, setShowExportMenu] = useState(false);

  // AI Operation states
  const [isGeneratingMeta, setIsGeneratingMeta] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [improvedResult, setImprovedResult] = useState<{ improvedContent: string; explanation: string } | null>(null);
  const [showImproveModal, setShowImproveModal] = useState(false);
  const [improvementAction, setImprovementAction] = useState<string>('');

  // AI Prompt Generation states
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generatePromptInput, setGeneratePromptInput] = useState('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  // Duplicate Warning states
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateWarningData, setDuplicateWarningData] = useState<{ duplicateOfTitle: string; reason: string; proceed: () => void } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Settings Modal states
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsMetaModel, setSettingsMetaModel] = useState('');
  const [settingsImproveModel, setSettingsImproveModel] = useState('');
  const [settingsEmbeddingModel, setSettingsEmbeddingModel] = useState('');
  const [installedModels, setInstalledModels] = useState<string[]>([]);

  // Modal Dialog states
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showColModal, setShowColModal] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColDesc, setNewColDesc] = useState('');

  // Initial load
  useEffect(() => {
    store.init();
    checkOllama();
  }, []);

  const checkOllama = () => {
    if (!window.api) return;
    window.api.getAiStatus()
      .then((online) => {
        setOllamaStatus(online ? 'connected' : 'offline');
        if (online) {
          window.api!.getAiModels().then(setInstalledModels);
        }
      })
      .catch(() => setOllamaStatus('offline'));
  };

  // Update settings inputs when store configurations change
  useEffect(() => {
    setSettingsMetaModel(store.metadataModel);
    setSettingsImproveModel(store.improveModel);
    setSettingsEmbeddingModel(store.embeddingModel);
  }, [store.metadataModel, store.improveModel, store.embeddingModel, showSettingsModal]);

  // Update form fields when active prompt changes
  useEffect(() => {
    currentSessionId.current += 1;
    if (store.activePrompt) {
      const p = store.activePrompt.prompt;
      setTitle(p.title);
      setDescription(p.description);
      setContent(store.activePrompt.latestVersion?.content || '');
      setNotes(p.notes || '');
      setCategoryId(p.categoryId);
      setTagsInput(p.tags.map(t => t.name).join(', '));
      setIsCreatingNew(false);
      setHasUnsavedChanges(false);
      setActiveTab('editor');
      setCompareVersionId(null);
      setVarValues({});
      setShowQualityPanel(false);

      // Setup default playground comparison targets
      setPlaygroundModels([store.metadataModel, store.improveModel]);
      setPlaygroundOutputs({});
      setPlaygroundStatuses({});
      setActiveExecutionId(null);
      loadPlaygroundHistory(p.id);
    } else if (isCreatingNew) {
      // Keep creation state
    } else {
      // Empty state
      setTitle('');
      setDescription('');
      setContent('');
      setNotes('');
      setCategoryId(null);
      setTagsInput('');
      setHasUnsavedChanges(false);
      setActiveTab('editor');
      setShowQualityPanel(false);
    }
  }, [store.activePrompt, isCreatingNew]);

  // Load playground history logs (Milestone 6)
  const loadPlaygroundHistory = async (promptId: string) => {
    if (!window.api) return;
    const history = await window.api.getPlaygroundHistory(promptId);
    setPlaygroundHistory(history);
  };

  // Real-time Concurrent Playground streaming chunk updates listener (Milestone 6)
  useEffect(() => {
    if (!window.api || !activeExecutionId) return;

    const unsub = window.api.onPlaygroundChunk((data) => {
      if (data.executionId === activeExecutionId) {
        if (!data.done) {
          setPlaygroundOutputs(prev => ({
            ...prev,
            [data.model]: (prev[data.model] || '') + data.text
          }));
        } else {
          setPlaygroundStatuses(prev => ({
            ...prev,
            [data.model]: 'done'
          }));
        }
      }
    });

    return () => unsub();
  }, [activeExecutionId]);

  // Run Comparison Playground comparison stream (Milestone 6)
  const handleRunPlaygroundComparison = async () => {
    if (!window.api || playgroundModels.length === 0) return;
    if (ollamaStatus !== 'connected') {
      alert('Start Ollama locally to run model playground comparison.');
      return;
    }

    const compiled = compileTemplate(content, varValues);
    const execId = `exec_${Date.now()}`;

    // Clear outputs and set status to streaming
    const initialOutputs: Record<string, string> = {};
    const initialStatuses: Record<string, 'streaming' | 'idle'> = {};
    playgroundModels.forEach(m => {
      initialOutputs[m] = '';
      initialStatuses[m] = 'streaming';
    });

    setPlaygroundOutputs(initialOutputs);
    setPlaygroundStatuses(initialStatuses);
    setActiveExecutionId(execId);

    await window.api.runPlayground(compiled, playgroundModels, execId, store.activePromptId);

    // Periodically reload history logs once execution finishes
    setTimeout(() => {
      if (store.activePromptId) {
        loadPlaygroundHistory(store.activePromptId);
      }
    }, 6000);
  };

  const handleAddPlaygroundColumn = () => {
    if (playgroundModels.length >= 4) {
      alert('You can compare a maximum of 4 models side-by-side.');
      return;
    }
    const nextModel = installedModels.find(m => !playgroundModels.includes(m)) || installedModels[0] || 'qwen3:14b';
    setPlaygroundModels([...playgroundModels, nextModel]);
  };

  const handleRemovePlaygroundColumn = (idx: number) => {
    if (playgroundModels.length <= 1) {
      alert('You must have at least 1 column for comparison.');
      return;
    }
    const filtered = playgroundModels.filter((_, i) => i !== idx);
    setPlaygroundModels(filtered);
  };

  const handleUpdatePlaygroundModel = (idx: number, modelName: string) => {
    const updated = [...playgroundModels];
    updated[idx] = modelName;
    setPlaygroundModels(updated);
  };

  // Handle autosave simulation / edit warnings
  const handleFieldChange = (field: string, value: any) => {
    setHasUnsavedChanges(true);
    if (field === 'title') setTitle(value);
    if (field === 'description') setDescription(value);
    if (field === 'content') setContent(value);
    if (field === 'notes') setNotes(value);
    if (field === 'categoryId') setCategoryId(value === 'null' ? null : value);
  };

  const handleCreateNewClick = () => {
    currentSessionId.current += 1;
    setIsCreatingNew(true);
    store.selectPrompt(null);
    setTitle('New Prompt');
    setDescription('Brief description of the prompt');
    setContent('Write your prompt template here. Use {{variable}} for placeholders.');
    setNotes('');
    setCategoryId(null);
    setTagsInput('');
    setHasUnsavedChanges(true);
    setActiveTab('editor');
    setShowQualityPanel(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const proceedWithSave = async () => {
        try {
          const tagsArray: Tag[] = tagsInput
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0)
            .map(t => ({ id: `tag_${t.toLowerCase().replace(/[^a-z0-9]/g, '_')}`, name: t }));

          if (isCreatingNew) {
            await store.createPrompt(title, content, description, categoryId, tagsArray);
            setIsCreatingNew(false);
            setHasUnsavedChanges(false);
          } else if (store.activePromptId) {
            const currentContent = store.activePrompt?.latestVersion?.content || '';
            const contentChanged = currentContent !== content;

            await store.updatePrompt(store.activePromptId, {
              title,
              description,
              categoryId,
              notes,
              tags: tagsArray,
              content: contentChanged ? content : undefined,
              changeDescription: contentChanged ? `Edited prompt text` : undefined
            });
            setHasUnsavedChanges(false);
          }
          setShowDuplicateWarning(false);
        } finally {
          setIsSaving(false);
        }
      };

      if (window.api && ollamaStatus === 'connected') {
        setIsGeneratingMeta(true);
        const res = await window.api.detectDuplicate(title, content, store.metadataModel);
        setIsGeneratingMeta(false);

        if (res.isDuplicate && res.duplicateOfPromptId !== store.activePromptId) {
          setDuplicateWarningData({
            duplicateOfTitle: res.duplicateOfTitle || 'Existing Prompt',
            reason: res.reason || 'Semantic similarity detected.',
            proceed: proceedWithSave
          });
          setShowDuplicateWarning(true);
          setIsSaving(false);
          return;
        }
      }

      await proceedWithSave();
    } catch (err) {
      console.error(err);
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (isCreatingNew) {
      setIsCreatingNew(false);
      setHasUnsavedChanges(false);
    } else {
      store.selectPrompt(store.activePromptId);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      await store.createCategory(newFolderName.trim());
      setNewFolderName('');
      setShowFolderModal(false);
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newColName.trim()) {
      await store.createCollection(newColName.trim(), newColDesc.trim());
      setNewColName('');
      setNewColDesc('');
      setShowColModal(false);
    }
  };

  // Portability functions
  const handleExport = async (format: 'markdown' | 'json') => {
    if (!store.activePromptId) return;
    const success = await store.exportPrompt(store.activePromptId, format);
    setShowExportMenu(false);
    if (success) {
      alert(`Prompt exported successfully as ${format.toUpperCase()}!`);
    }
  };

  const handleImport = async () => {
    const success = await store.importPrompt();
    if (success) {
      alert('Prompt imported successfully!');
    }
  };

  // Save Settings Modal
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await store.saveSettings(settingsMetaModel, settingsImproveModel, settingsEmbeddingModel);
    setShowSettingsModal(false);
  };

  // AI Metadata Suggestion
  const handleSuggestMetadata = async () => {
    if (!window.api || !content.trim()) return;
    if (ollamaStatus !== 'connected') {
      alert('Ollama is offline. Start Ollama locally to use AI Suggestions.');
      return;
    }

    const sessionId = currentSessionId.current;
    const targetPromptId = store.activePromptId;
    const targetContent = content;
    const targetNotes = notes;

    setIsGeneratingMeta(true);
    try {
      const result = await window.api.suggestMetadata(content, store.metadataModel);

      if (result) {
        // Map category if provided
        let finalCategoryId = categoryId;
        if (result.category) {
          const match = store.categories.find(c => c.name.toLowerCase() === result.category.toLowerCase());
          if (match) {
            finalCategoryId = match.id;
          } else {
            const newCatId = `cat_${Date.now()}`;
            await window.api.createCategory({ id: newCatId, name: result.category, parentId: null });
            await store.fetchCategories();
            finalCategoryId = newCatId;
          }
        }

        const tagsArray: Tag[] = result.tags.map(t => ({
          id: `tag_${t.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          name: t
        }));

        // Guard: Check if user switched prompts in the meantime
        if (currentSessionId.current !== sessionId) {
          if (targetPromptId) {
            // Update existing prompt in DB
            await store.updatePrompt(targetPromptId, {
              title: result.title,
              description: result.description,
              categoryId: finalCategoryId,
              notes: targetNotes,
              tags: tagsArray
            });
            alert(`AI Autocomplete finished for "${result.title}". Changes saved in background.`);
          } else {
            // Create new prompt in DB
            await store.createPrompt(result.title, targetContent, result.description, finalCategoryId, tagsArray);
            alert(`AI Autocomplete finished. New prompt "${result.title}" created in background.`);
          }
          return;
        }

        // Active prompt didn't change: update current editor form states
        setTitle(result.title);
        setDescription(result.description);
        setTagsInput(result.tags.join(', '));
        setCategoryId(finalCategoryId);
        setHasUnsavedChanges(true);
      } else {
        alert('Failed to generate suggestions. Check that Ollama model is downloaded.');
      }
    } catch (err) {
      console.error(err);
      alert(`Error generating metadata suggestions: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsGeneratingMeta(false);
    }
  };

  // AI Improvement trigger
  const handleImproveAction = async (action: 'simplify' | 'detail' | 'explain' | 'check_ambiguity') => {
    if (!window.api) return;
    if (ollamaStatus !== 'connected') {
      alert('Ollama is offline. Start Ollama locally to use AI Tools.');
      return;
    }

    const sessionId = currentSessionId.current;
    const targetPromptId = store.activePromptId;
    const targetTitle = title;
    const targetDescription = description;
    const targetCategoryId = categoryId;
    const targetNotes = notes;
    const targetTagsArray: Tag[] = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0)
      .map(t => ({ id: `tag_${t.toLowerCase().replace(/[^a-z0-9]/g, '_')}`, name: t }));

    setIsImproving(true);
    setImprovementAction(action);
    try {
      const res = await window.api.improvePrompt(content, action, store.improveModel);

      // Guard: Check if user switched prompts in the meantime
      if (currentSessionId.current !== sessionId) {
        if (targetPromptId) {
          if (action === 'explain' || action === 'check_ambiguity') {
            // Alert user with explanation/audit report
            alert(`AI Analysis (${action}) for prompt "${targetTitle}":\n\n${res.explanation}`);
          } else {
            // Simplify/Detail - save new version directly in DB
            await store.updatePrompt(targetPromptId, {
              title: targetTitle,
              description: targetDescription,
              categoryId: targetCategoryId,
              notes: targetNotes,
              tags: targetTagsArray,
              content: res.improvedContent,
              changeDescription: `AI Improvement (${action})`
            });
            alert(`AI Improvement (${action}) applied to prompt "${targetTitle}" in background.`);
          }
        }
        return;
      }

      setImprovedResult(res);
      setShowImproveModal(true);
    } catch (err) {
      console.error(err);
      alert(`Error generating AI improvements: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsImproving(false);
    }
  };

  const handleApplyImprovement = () => {
    if (improvedResult) {
      setContent(improvedResult.improvedContent);
      setHasUnsavedChanges(true);
      setShowImproveModal(false);
      setImprovedResult(null);
    }
  };

  const handleGeneratePrompt = async () => {
    if (!window.api || !generatePromptInput.trim()) return;
    if (ollamaStatus !== 'connected') {
      alert('Ollama is offline. Start Ollama locally to use AI generation.');
      return;
    }

    setIsGeneratingPrompt(true);
    try {
      const result = await window.api.generatePrompt(generatePromptInput, store.improveModel);
      if (result) {
        // Immediately create the prompt in SQLite database
        await store.createPrompt(
          result.title,
          result.content,
          result.description,
          null, // categoryId
          []    // tags
        );

        // Close modal and reset state
        setShowGenerateModal(false);
        setGeneratePromptInput('');
      } else {
        alert('Failed to generate prompt template.');
      }
    } catch (err) {
      console.error(err);
      alert(`Error generating prompt: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  // Compile variables
  const variablesList = extractVariables(content);
  const compiledContent = compileTemplate(content, varValues);

  const handleCopyCompiled = () => {
    navigator.clipboard.writeText(compiledContent).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  // Run Quality Analyzer
  const qualityReport = analyzePromptQuality(content);

  // Diff rendering helper
  const renderDiff = () => {
    if (!compareVersionId || !store.activePrompt) return null;
    const oldVersion = store.activePrompt.versions.find(v => v.id === compareVersionId);
    if (!oldVersion) return null;

    const diffs = computeLineDiff(oldVersion.content, content);
    return (
      <div className="bg-slate-950/65 rounded-xl border border-outline-variant p-4 font-mono text-xs leading-relaxed max-h-[450px] overflow-y-auto whitespace-pre-wrap select-text text-left">
        {diffs.map((line, idx) => {
          let bgClass = '';
          let prefix = ' ';
          if (line.type === 'added') {
            bgClass = 'bg-emerald-950/30 text-emerald-300 border-l-2 border-emerald-500 pl-2';
            prefix = '+';
          } else if (line.type === 'removed') {
            bgClass = 'bg-rose-950/30 text-rose-300 border-l-2 border-rose-500 pl-2 line-through';
            prefix = '-';
          } else {
            bgClass = 'text-slate-400 pl-2';
          }

          return (
            <div key={idx} className={`${bgClass} py-0.5 flex gap-2`}>
              <span className="opacity-50 select-none">{prefix}</span>
              <span>{line.content || ' '}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'bg-emerald-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="h-screen w-full overflow-hidden flex bg-background text-on-background selection:bg-primary/30 selection:text-on-surface antialiased font-sans">

      {/* Rebuilding Index Loading Overlay */}
      {store.isRebuildingIndex && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-8">
          <div className="w-80 space-y-4 text-center">
            <span className="text-4xl animate-bounce block">⚡</span>
            <h3 className="text-lg font-bold text-on-surface">Rebuilding Semantic Search Index...</h3>
            <p className="text-xs text-on-surface-variant">
              Generating nomic vector embeddings for your prompt versions using Ollama.
            </p>
            <div className="w-full bg-surface-container-highest rounded-full h-2.5 overflow-hidden border border-white/5 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
              <div
                className="bg-gradient-to-r from-primary to-secondary h-2.5 transition-all duration-300"
                style={{ width: `${store.rebuildPercent}%` }}
              ></div>
            </div>
            <span className="font-mono text-xs text-primary block">{store.rebuildPercent}% Complete</span>
          </div>
        </div>
      )}

      {/* 1. Left Sidebar Navigation */}
      <nav className="fixed left-0 top-0 h-full flex flex-col pt-6 bg-surface-container-lowest/65 text-primary w-64 backdrop-blur-2xl border-r border-white/10 shrink-0 z-40">

        <div className="px-6 mb-4 flex flex-col gap-2">
          <button
            onClick={handleCreateNewClick}
            disabled={isSaving}
            className="w-full bg-primary text-slate-950 font-semibold text-sm py-2 px-4 rounded-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(192,193,255,0.25)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icons.Add />
            Create New Prompt
          </button>
          <button
            onClick={handleImport}
            disabled={isSaving}
            className="w-full bg-white/5 border border-white/10 text-on-surface hover:bg-white/10 font-semibold text-xs py-1.5 px-4 rounded-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icons.Import />
            Import (.json, .md, .txt)
          </button>
          <button
            onClick={() => {
              if (ollamaStatus !== 'connected') {
                alert('Start Ollama locally to use AI generation.');
                return;
              }
              setShowGenerateModal(true);
            }}
            disabled={isSaving}
            className="w-full bg-secondary text-slate-950 font-bold text-xs py-2 px-4 rounded-lg hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icons.Sparkles />
            Generate with AI
          </button>
        </div>

        {/* Scrollable Navigation Lists */}
        <div className={`flex-1 overflow-y-auto px-2 pb-6 space-y-6 ${isSaving ? 'pointer-events-none opacity-50' : ''}`}>
          {/* Library Navigation */}
          <div>
            <div className="px-4 py-1.5 flex items-center gap-2 bg-primary/10 text-primary rounded-lg font-medium text-sm">
              <Icons.FolderOpen />
              <span>Library</span>
            </div>
            <div className="pl-8 pr-4 flex flex-col gap-1 mt-2 text-sm">
              <button
                onClick={() => {
                  store.setSelectedCategoryId(undefined);
                  store.setSelectedCollectionId(null);
                  store.setSelectedTagId(null);
                  store.setOnlyFavorites(false);
                }}
                className={`text-left py-1 transition-colors flex items-center justify-between ${!store.onlyFavorites && !store.selectedCategoryId && !store.selectedCollectionId && !store.selectedTagId
                  ? 'text-primary font-medium' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
              >
                <span>All Prompts</span>
                <span className="text-xs bg-surface-variant px-1.5 py-0.5 rounded text-on-surface-variant">
                  {store.prompts.length}
                </span>
              </button>
              <button
                onClick={() => store.setOnlyFavorites(true)}
                className={`text-left py-1 transition-colors flex items-center justify-between ${store.onlyFavorites ? 'text-primary font-medium' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
              >
                <span>Favorites</span>
              </button>
              <button
                onClick={() => store.setShowArchived(!store.showArchived)}
                className={`text-left py-1 transition-colors flex items-center justify-between ${store.showArchived ? 'text-primary font-medium' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
              >
                <span>Show Archived</span>
              </button>
            </div>
          </div>

          {/* Categories Section (Folders) */}
          <div>
            <div className="px-4 py-1.5 flex items-center justify-between text-on-surface-variant hover:text-on-surface transition-all duration-200 rounded-lg group">
              <div className="flex items-center gap-2 font-medium text-sm">
                <Icons.Folder />
                <span>Categories</span>
              </div>
              <button
                onClick={() => setShowFolderModal(true)}
                className="opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity cursor-pointer"
              >
                <Icons.Add />
              </button>
            </div>
            <div className="pl-8 pr-4 flex flex-col gap-1 mt-2 text-sm max-h-40 overflow-y-auto">
              {store.categories.map(cat => (
                <div key={cat.id} className="flex justify-between items-center group">
                  <button
                    onClick={() => {
                      store.setSelectedCategoryId(cat.id);
                      store.setOnlyFavorites(false);
                    }}
                    className={`text-left py-1 transition-colors flex items-center gap-2 truncate ${store.selectedCategoryId === cat.id ? 'text-primary font-medium' : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                  >
                    <span>/ {cat.name}</span>
                  </button>
                  <button
                    onClick={() => store.deleteCategory(cat.id)}
                    className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-500 transition-opacity ml-1 cursor-pointer"
                    title="Delete Category"
                  >
                    ×
                  </button>
                </div>
              ))}
              {store.categories.length === 0 && (
                <span className="text-xs text-on-surface-variant/40 italic">No categories created</span>
              )}
            </div>
          </div>

          {/* Collections Section */}
          <div>
            <div className="px-4 py-1.5 flex items-center justify-between text-on-surface-variant hover:text-on-surface transition-all duration-200 rounded-lg group">
              <div className="flex items-center gap-2 font-medium text-sm">
                <Icons.Collections />
                <span>Collections</span>
              </div>
              <button
                onClick={() => setShowColModal(true)}
                className="opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity cursor-pointer"
              >
                <Icons.Add />
              </button>
            </div>
            <div className="pl-8 pr-4 flex flex-col gap-1 mt-2 text-sm max-h-40 overflow-y-auto">
              {store.collections.map(col => (
                <div key={col.id} className="flex justify-between items-center group">
                  <button
                    onClick={() => {
                      store.setSelectedCollectionId(col.id);
                      store.setOnlyFavorites(false);
                    }}
                    className={`text-left py-1 transition-colors flex items-center gap-2 truncate ${store.selectedCollectionId === col.id ? 'text-primary font-medium' : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                    <span>{col.name}</span>
                  </button>
                  <button
                    onClick={() => store.deleteCollection(col.id)}
                    className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-500 transition-opacity ml-1 cursor-pointer"
                    title="Delete Collection"
                  >
                    ×
                  </button>
                </div>
              ))}
              {store.collections.length === 0 && (
                <span className="text-xs text-on-surface-variant/40 italic">No collections created</span>
              )}
            </div>
          </div>

          {/* Tags Section */}
          <div className="px-4">
            <div className="flex items-center gap-2 text-on-surface-variant text-sm font-medium mb-2">
              <Icons.Tag />
              <span>Tags</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {store.tags.map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    store.setSelectedTagId(store.selectedTagId === t.id ? null : t.id);
                    store.setOnlyFavorites(false);
                  }}
                  className={`text-[10px] px-2 py-0.5 rounded-full transition-colors border cursor-pointer ${store.selectedTagId === t.id
                    ? 'bg-primary/20 text-primary border-primary/40'
                    : 'bg-surface-variant text-on-surface border-white/5 hover:bg-primary/10'
                    }`}
                >
                  {t.name}
                </button>
              ))}
              {store.tags.length === 0 && (
                <span className="text-xs text-on-surface-variant/40 italic">No tags</span>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Footer status badges */}
        <div className="p-4 border-t border-white/10 mt-auto bg-surface-container-lowest/80 backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between items-center text-[11px] text-on-surface-variant bg-surface-variant/50 p-2 rounded border border-white/5">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${store.dbStatus ? 'bg-secondary shadow-[0_0_5px_#4fdbc8]' : 'bg-rose-500'}`}></div>
              <span>SQLite {store.dbStatus ? 'Connected' : 'Offline'}</span>
            </div>
          </div>
          <div className="flex items-center justify-between items-center text-[11px] text-on-surface-variant bg-surface-variant/50 p-2 rounded border border-white/5">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${ollamaStatus === 'connected' ? 'bg-secondary shadow-[0_0_5px_#4fdbc8]' : 'bg-rose-500'}`}></div>
              <span>Ollama {ollamaStatus === 'connected' ? 'Online' : 'Offline'}</span>
            </div>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="hover:text-primary transition-colors cursor-pointer"
              title="Open Config"
            >
              <Icons.Settings />
            </button>
          </div>
        </div>
      </nav>

      {/* 2. Middle Column: Library List */}
      <main className="ml-64 flex-1 flex h-full">
        <div className="w-[575px] border-r border-white/10 flex flex-col glass-panel z-30 shrink-0">

          {/* Stale Embeddings Rebuild Index Warning Banner */}
          {store.searchStaleStatus.isStale && ollamaStatus === 'connected' && (
            <div className="bg-amber-950/25 border-b border-amber-500/25 p-3 flex flex-col gap-2 shrink-0">
              <div className="flex gap-2 text-xs text-amber-300 items-start">
                <span className="text-base select-none">⚠️</span>
                <div className="text-left">
                  <strong>Semantic index needs rebuild!</strong>
                  <p className="text-[10px] text-on-surface-variant/80 mt-0.5">
                    {store.searchStaleStatus.staleCount} prompts are missing vector embeddings.
                  </p>
                </div>
              </div>
              <button
                onClick={() => store.rebuildSemanticIndex()}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] py-1 px-3 rounded cursor-pointer transition-colors"
              >
                Rebuild Index
              </button>
            </div>
          )}

          <div className="p-4 border-b border-white/10 shrink-0">
            {/* Search Input with Semantic Toggle */}
            <div className="flex flex-col gap-2">
              <div className="relative group">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors">
                  <Icons.Search />
                </span>
                <input
                  type="text"
                  value={store.searchQuery}
                  onChange={(e) => store.setSearchQuery(e.target.value)}
                  placeholder={store.isSemanticMode ? "Semantic search prompts..." : "Keyword search prompts..."}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-lg pl-10 pr-4 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all focus:active-glow"
                />
              </div>

              <button
                onClick={() => {
                  if (ollamaStatus !== 'connected') {
                    alert('Start Ollama locally to use Semantic Vector Search.');
                    return;
                  }
                  store.setIsSemanticMode(!store.isSemanticMode);
                }}
                className={`w-full py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${store.isSemanticMode
                  ? 'bg-primary/20 text-primary border-primary active-glow font-bold'
                  : 'bg-surface-container border-outline-variant text-slate-400 hover:text-on-surface'
                  }`}
                title="Toggle Semantic Similarity Search (requires Ollama)"
              >
                <Icons.Sparkles />
                <span>{store.isSemanticMode ? 'Semantic Search: ON' : 'AI Semantic Search'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between mt-3 text-xs text-on-surface-variant">
              <div>
                {store.selectedCategoryId || store.selectedCollectionId || store.selectedTagId || store.onlyFavorites || store.searchQuery ? (
                  <button
                    onClick={() => {
                      store.setSelectedCategoryId(undefined);
                      store.setSelectedCollectionId(null);
                      store.setSelectedTagId(null);
                      store.setOnlyFavorites(false);
                      store.setSearchQuery('');
                    }}
                    className="text-primary hover:underline cursor-pointer text-left"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
              <span className="text-right">
                {store.prompts.length} Prompts found {store.isSemanticMode && '(vector rank)'}
              </span>
            </div>
          </div>

          {/* Prompts list scroll area */}
          <div className={`flex-1 overflow-y-auto p-2 space-y-2 ${isSaving ? 'pointer-events-none opacity-50' : ''}`}>
            {store.prompts.map((p) => {
              const isActive = store.activePromptId === p.id;
              const catName = store.categories.find(c => c.id === p.categoryId)?.name || '';

              return (
                <div
                  key={p.id}
                  onClick={() => store.selectPrompt(p.id)}
                  className={`glass-card p-4 rounded-xl cursor-pointer relative overflow-hidden group border ${isActive ? 'border-primary/50 bg-primary/5 shadow-[0_0_15px_rgba(192,193,255,0.05)]' : 'border-transparent'
                    }`}
                >
                  {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-xl"></div>}
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <h3 className={`text-[15px] font-semibold leading-tight truncate ${isActive ? 'text-primary' : 'text-on-surface'}`}>
                      {p.title}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        store.toggleFavorite(p.id);
                      }}
                      className="cursor-pointer shrink-0"
                    >
                      {p.isFavorite ? <Icons.StarFilled /> : <Icons.StarOutlined />}
                    </button>
                  </div>
                  <p className="text-xs text-on-surface-variant/80 mb-3 line-clamp-2">
                    {p.description || 'No description provided.'}
                  </p>
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex gap-1.5 overflow-hidden">
                      {catName && (
                        <span className="px-1.5 py-0.5 rounded bg-surface-variant/80 text-on-surface-variant border border-white/5 truncate max-w-24">
                          / {catName}
                        </span>
                      )}
                      {p.tags.slice(0, 2).map(tag => (
                        <span key={tag.id} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/10 truncate max-w-16">
                          {tag.name}
                        </span>
                      ))}
                    </div>
                    {p.similarity !== undefined ? (
                      <span className="text-emerald-400 font-bold shrink-0 bg-emerald-950/20 px-1 rounded border border-emerald-500/10">
                        {Math.round(p.similarity * 100)}% match
                      </span>
                    ) : (
                      <span className="text-on-surface-variant/60 shrink-0">
                        {new Date(p.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {store.prompts.length === 0 && (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 h-64">
                <span className="text-2xl mb-2">📁</span>
                <p className="text-sm">No prompts found matching the filters.</p>
              </div>
            )}
          </div>
        </div>

        {/* 3. Right Panel: Active Editor Workspace & Collapsible Panels */}
        <div className="flex-1 flex bg-surface-dim z-20 overflow-hidden">
          {store.activePrompt || isCreatingNew ? (
            <div className="flex-1 flex overflow-hidden">

              {/* Main Workspace Frame */}
              <div className="flex-1 flex flex-col overflow-hidden border-r border-white/5">
                {/* Workspace Top Bar */}
                <div className="px-8 py-6 border-b border-white/10 glass-panel shrink-0 flex flex-col gap-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 flex flex-col gap-2 group/title">
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => handleFieldChange('title', e.target.value)}
                        disabled={isGeneratingMeta || isImproving || isSaving}
                        placeholder="Prompt Title"
                        className="w-full bg-transparent border-none text-2xl font-extrabold text-on-surface focus:outline-none focus:ring-0 p-0 py-2 disabled:opacity-75"
                      />
                      <input
                        type="text"
                        value={description}
                        onChange={(e) => handleFieldChange('description', e.target.value)}
                        disabled={isGeneratingMeta || isImproving || isSaving}
                        placeholder="Description (optional)"
                        className="w-full bg-transparent border-none text-md text-on-surface-variant focus:outline-none focus:ring-0 p-0 py-1 disabled:opacity-75"
                      />
                    </div>
                    <div className="flex items-center gap-3 shrink-0 relative mt-2">
                      {ollamaStatus === 'connected' && (
                        <button
                          onClick={handleSuggestMetadata}
                          disabled={isGeneratingMeta || isImproving || isSaving}
                          className={`px-4 py-2 rounded-xl bg-slate-900 border border-white/10 hover:border-primary/40 text-sm font-bold flex items-center gap-2 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${isGeneratingMeta ? 'animate-pulse' : ''}`}
                          title="Suggest metadata with Ollama AI (Title, Tags, Category)"
                        >
                          <Icons.Sparkles />
                          <span>{isGeneratingMeta ? 'Autogenerating...' : 'AI Autocomplete Fields'}</span>
                        </button>
                      )}
                      {!isCreatingNew && (
                        <>
                          <button
                            onClick={() => store.toggleFavorite(store.activePromptId!)}
                            className="p-2 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
                            title="Toggle Favorite"
                          >
                            {store.activePrompt?.prompt.isFavorite ? <Icons.StarFilled /> : <Icons.StarOutlined />}
                          </button>

                          {/* Export Menu Dropdown */}
                          <div className="relative">
                            <button
                              onClick={() => setShowExportMenu(!showExportMenu)}
                              className="p-2 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
                              title="Export Prompt"
                            >
                              <Icons.Export />
                            </button>
                            {showExportMenu && (
                              <div className="absolute right-0 mt-2 w-40 rounded-lg bg-surface-container border border-white/10 shadow-xl py-1 z-50">
                                <button
                                  onClick={() => handleExport('markdown')}
                                  className="w-full text-left px-4 py-2 text-xs text-on-surface hover:bg-primary/10 transition-colors"
                                >
                                  Export Markdown (.md)
                                </button>
                                <button
                                  onClick={() => handleExport('json')}
                                  className="w-full text-left px-4 py-2 text-xs text-on-surface hover:bg-primary/10 transition-colors"
                                >
                                  Export JSON (.json)
                                </button>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => store.deletePrompt(store.activePromptId!)}
                            className="p-2 rounded-full hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Delete Prompt"
                          >
                            <Icons.Delete />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-base mt-2">
                    <div className="flex items-center gap-4">
                      {/* Category dropdown selector */}
                      <div className="flex items-center gap-2.5 bg-surface-container border border-white/5 rounded-xl px-4 py-2.5">
                        <Icons.Folder />
                        <select
                          value={categoryId || 'null'}
                          onChange={(e) => handleFieldChange('categoryId', e.target.value)}
                          disabled={isGeneratingMeta || isImproving || isSaving}
                          className="bg-transparent border-none text-sm text-on-surface font-extrabold focus:outline-none focus:ring-0 cursor-pointer p-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="null" className="bg-surface-container text-on-surface">Uncategorized</option>
                          {store.categories.map(c => (
                            <option key={c.id} value={c.id} className="bg-surface-container text-on-surface">{c.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Collections membership manager */}
                      {!isCreatingNew && store.activePrompt && (
                        <div className="flex items-center gap-2.5 bg-surface-container border border-white/5 rounded-xl px-4 py-2.5">
                          <Icons.Collections />
                          <span className="text-sm text-on-surface-variant font-extrabold">Collections:</span>
                          <select
                            onChange={async (e) => {
                              const val = e.target.value;
                              if (val) {
                                if (val.startsWith('add:')) {
                                  await store.addPromptToCollection(store.activePromptId!, val.substring(4));
                                } else if (val.startsWith('remove:')) {
                                  await store.removePromptFromCollection(store.activePromptId!, val.substring(7));
                                }
                              }
                              e.target.value = '';
                            }}
                            disabled={isGeneratingMeta || isImproving || isSaving}
                            className="bg-transparent border-none text-sm text-on-surface font-extrabold focus:outline-none focus:ring-0 cursor-pointer p-0 max-w-[180px] disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="" className="bg-surface-container text-on-surface">Manage...</option>
                            {store.collections.map(col => {
                              const belongs = store.activePrompt?.collections.some(c => c.id === col.id);
                              return (
                                <option key={col.id} value={belongs ? `remove:${col.id}` : `add:${col.id}`} className="bg-surface-container text-on-surface">
                                  {belongs ? '✓ ' : '+ '} {col.name}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Workspace Tabs & Collapsible Quality Trigger */}
                    <div className="flex items-center gap-4">
                      {!isCreatingNew && store.activePrompt && (
                        <div className="flex border border-white/10 rounded-xl p-1 bg-surface-container-low">
                          <button
                            onClick={() => setActiveTab('editor')}
                            className={`px-4 py-2 text-sm rounded-lg font-semibold transition-all ${activeTab === 'editor' ? 'bg-primary text-slate-950 font-bold' : 'text-on-surface-variant hover:text-on-surface'
                              }`}
                          >
                            Template
                          </button>
                          <button
                            onClick={() => setActiveTab('variables')}
                            className={`px-4 py-2 text-sm rounded-lg font-semibold transition-all flex items-center gap-1.5 ${activeTab === 'variables' ? 'bg-primary text-slate-950 font-bold' : 'text-on-surface-variant hover:text-on-surface'
                              }`}
                          >
                            <span>Variables</span>
                            {variablesList.length > 0 && (
                              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                            )}
                          </button>
                          <button
                            onClick={() => setActiveTab('playground')}
                            className={`px-4 py-2 text-sm rounded-lg font-semibold transition-all flex items-center gap-1.5 ${activeTab === 'playground' ? 'bg-primary text-slate-950 font-bold' : 'text-on-surface-variant hover:text-on-surface'
                              }`}
                          >
                            <span>Playground</span>
                          </button>
                          <button
                            onClick={() => setActiveTab('history')}
                            className={`px-4 py-2 text-sm rounded-lg font-semibold transition-all flex items-center gap-1.5 ${activeTab === 'history' ? 'bg-primary text-slate-950 font-bold' : 'text-on-surface-variant hover:text-on-surface'
                              }`}
                          >
                            <span>History</span>
                            <span className="text-xs opacity-70">({store.activePrompt.versions.length})</span>
                          </button>
                        </div>
                      )}

                      {/* Quality analyzer panel toggle */}
                      {content.trim().length > 0 && (
                        <button
                          onClick={() => setShowQualityPanel(!showQualityPanel)}
                          className={`px-4 py-2 border rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${showQualityPanel
                            ? 'bg-secondary/15 border-secondary text-secondary'
                            : 'bg-surface-container border-white/10 text-slate-400 hover:text-on-surface'
                            }`}
                        >
                          <span>📊 Quality:</span>
                          <span className={`font-extrabold ${qualityReport.overall >= 75 ? 'text-emerald-400' : qualityReport.overall >= 40 ? 'text-amber-400' : 'text-rose-400'
                            }`}>
                            {qualityReport.overall}%
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Workspace Editor Body */}
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

                  {/* TAB 1: Main Template Editor */}
                  {activeTab === 'editor' && (
                    <div className="flex-1 flex flex-col min-h-[350px]">
                      <div className="flex items-center justify-between mb-4">
                        <label className="text-sm font-semibold text-on-surface flex items-center gap-2">
                          <span className="text-xl">📝</span>
                          Prompt Template
                        </label>

                        {/* AI Improvements Button Toolbar */}
                        {ollamaStatus === 'connected' && content.trim().length > 10 && (
                          <div className="flex items-center gap-2 bg-surface-container border border-white/5 rounded-xl p-1 shrink-0 select-none">
                            <span className="text-xs text-on-surface-variant font-bold px-3 flex items-center gap-1.5">
                              <Icons.Sparkles /> AI Tools:
                            </span>
                            <button
                              onClick={() => handleImproveAction('simplify')}
                              disabled={isImproving || isGeneratingMeta || isSaving}
                              className="text-xs font-bold text-on-surface hover:text-primary hover:bg-white/10 px-3 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Simplify
                            </button>
                            <button
                              onClick={() => handleImproveAction('detail')}
                              disabled={isImproving || isGeneratingMeta || isSaving}
                              className="text-xs font-bold text-on-surface hover:text-primary hover:bg-white/10 px-3 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Detail
                            </button>
                            <button
                              onClick={() => handleImproveAction('check_ambiguity')}
                              disabled={isImproving || isGeneratingMeta || isSaving}
                              className="text-xs font-bold text-on-surface hover:text-primary hover:bg-white/10 px-3 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Audit
                            </button>
                            <button
                              onClick={() => handleImproveAction('explain')}
                              disabled={isImproving || isGeneratingMeta || isSaving}
                              className="text-xs font-bold text-on-surface hover:text-primary hover:bg-white/10 px-3 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Explain
                            </button>
                            {isImproving && (
                              <span className="text-xs font-semibold text-primary px-3 animate-pulse">Running...</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Code Editor Frame */}
                      <div className="flex-1 editor-bg rounded-xl border border-outline-variant flex flex-col overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)] focus-within:border-primary focus-within:active-glow transition-all">
                        <div className="bg-surface-container-lowest/50 px-4 py-1.5 border-b border-white/5 flex items-center justify-between text-xs text-on-surface-variant font-mono">
                          <div className="flex gap-4">
                            <button className="hover:text-primary transition-colors flex items-center gap-1">
                              <Icons.Tag />
                              <span>Insert Variable</span>
                            </button>
                          </div>
                          <span>V{store.activePrompt?.latestVersion?.versionNumber || 1} (Latest)</span>
                        </div>
                        <textarea
                          value={content}
                          onChange={(e) => handleFieldChange('content', e.target.value)}
                          disabled={isGeneratingMeta || isImproving || isSaving}
                          spellCheck={false}
                          className="flex-1 w-full bg-transparent border-none p-4 font-mono text-sm text-on-surface focus:outline-none focus:ring-0 resize-none leading-relaxed disabled:opacity-75"
                        />
                      </div>
                    </div>
                  )}

                  {/* TAB 2: Compile & Run Variables Panel */}
                  {activeTab === 'variables' && (
                    <div className="flex-1 flex flex-col gap-6">
                      <div>
                        <h3 className="text-[15px] font-bold text-on-surface mb-1 flex items-center gap-2">
                          <span>🧪</span> Template Variables Compiler
                        </h3>
                        <p className="text-xs text-on-surface-variant">
                          Fill in values for the parsed placeholders to compile and review the final prompt.
                        </p>
                      </div>

                      {variablesList.length > 0 ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-4">
                            <h4 className="text-xs font-bold uppercase text-primary/70 tracking-wider">Placeholders</h4>
                            {variablesList.map(v => (
                              <div key={v} className="flex flex-col gap-1 text-left">
                                <label className="text-xs font-mono font-bold text-on-surface-variant">{`{{${v}}}`}</label>
                                <input
                                  type="text"
                                  value={varValues[v] || ''}
                                  onChange={(e) => setVarValues({ ...varValues, [v]: e.target.value })}
                                  placeholder={`Enter value for ${v}...`}
                                  className="bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-0"
                                />
                              </div>
                            ))}
                          </div>

                          <div className="flex flex-col">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-xs font-bold uppercase text-primary/70 tracking-wider">Compiled Preview</h4>
                              <button
                                onClick={handleCopyCompiled}
                                className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <Icons.Copy />
                                {copySuccess ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                            <textarea
                              value={compiledContent}
                              readOnly
                              className="flex-1 w-full editor-bg rounded-xl border border-outline-variant p-4 font-mono text-xs text-slate-300 resize-none focus:outline-none"
                              placeholder="Compiled template preview will show up here..."
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-900/40 rounded-xl border border-white/5 p-8 text-center text-on-surface-variant/60 h-48 flex flex-col items-center justify-center">
                          <span className="text-xl mb-1">🔍</span>
                          <p className="text-sm font-semibold">No variables detected.</p>
                          <p className="text-xs max-w-xs mt-1">
                            Declare variables in your prompt text using the double brace template notation, e.g. <code>{`{{my_var}}`}</code>.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: Parallel Model Playground Comparison (Milestone 6) */}
                  {activeTab === 'playground' && (
                    <div className="flex-1 flex flex-col gap-6">
                      <div className="flex items-center justify-between">
                        <div className="text-left">
                          <h3 className="text-[15px] font-bold text-on-surface mb-1 flex items-center gap-2">
                            <span>🎮</span> Parallel Model Comparison Playground
                          </h3>
                          <p className="text-xs text-on-surface-variant">
                            Stream responses concurrently from different local models to compare speed and formatting.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowPlaygroundHistory(!showPlaygroundHistory)}
                            className={`px-3 py-1.5 border rounded-lg text-xs font-semibold cursor-pointer ${showPlaygroundHistory ? 'bg-secondary/20 border-secondary text-secondary' : 'bg-white/5 border-white/10 hover:bg-white/10'
                              }`}
                          >
                            {showPlaygroundHistory ? 'Hide Logs' : 'View Execution Logs'}
                          </button>
                          <button
                            onClick={handleAddPlaygroundColumn}
                            className="bg-white/5 border border-white/10 hover:bg-white/10 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer font-semibold"
                          >
                            <Icons.Add /> Add Column
                          </button>
                          <button
                            onClick={handleRunPlaygroundComparison}
                            className="bg-gradient-to-r from-primary to-secondary text-slate-950 font-extrabold text-xs px-4 py-1.5 rounded-lg flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shadow-md cursor-pointer"
                          >
                            <Icons.Play /> Run Comparison
                          </button>
                        </div>
                      </div>

                      {/* Playground history logs dropdown pane */}
                      {showPlaygroundHistory && (
                        <div className="bg-slate-950/70 border border-white/10 rounded-xl p-4 text-left max-h-56 overflow-y-auto space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-primary/70">Past Playground Executes</h4>
                          {playgroundHistory.length > 0 ? (
                            <div className="space-y-1.5 font-mono text-[10px]">
                              {playgroundHistory.map((h, i) => (
                                <div key={i} className="flex justify-between items-center p-2 rounded bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                                  <div className="flex items-center gap-4">
                                    <span className="text-slate-400 font-bold">{new Date(h.createdAt).toLocaleTimeString()}</span>
                                    <span className="text-primary font-bold">{h.model}</span>
                                    <span className="text-on-surface-variant/80 max-w-sm truncate italic">"{h.response}"</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-on-surface-variant/40 italic block p-2">No historical comparative runs logged yet</span>
                          )}
                        </div>
                      )}

                      {/* Top Variables input card if prompt has placeholders */}
                      {variablesList.length > 0 && (
                        <div className="bg-surface-container-low/40 rounded-xl border border-white/5 p-4 text-left space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-primary/70">Active Variable placeholders</h4>
                          <div className="flex flex-wrap gap-4">
                            {variablesList.map(v => (
                              <div key={v} className="flex flex-col gap-1 w-60">
                                <label className="text-[10px] font-mono font-bold text-on-surface-variant">{`{{${v}}}`}</label>
                                <input
                                  type="text"
                                  value={varValues[v] || ''}
                                  onChange={(e) => setVarValues({ ...varValues, [v]: e.target.value })}
                                  placeholder={`Value...`}
                                  className="bg-slate-900 border border-outline-variant rounded-md p-1.5 text-xs text-on-surface focus:outline-none"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Side-by-side comparative split grid */}
                      <div className="grid gap-4 flex-1 items-stretch" style={{ gridTemplateColumns: `repeat(${playgroundModels.length}, minmax(0, 1fr))` }}>
                        {playgroundModels.map((model, idx) => {
                          const status = playgroundStatuses[model] || 'idle';
                          const output = playgroundOutputs[model] || '';

                          return (
                            <div key={idx} className="bg-surface-container-lowest/40 rounded-xl border border-white/10 flex flex-col overflow-hidden min-h-[300px] shadow-lg">
                              {/* Column Header */}
                              <div className="bg-surface-container-low px-3 py-2 border-b border-white/5 flex items-center justify-between gap-2 shrink-0">
                                <div className="flex-1 text-left">
                                  {installedModels.length > 0 ? (
                                    <select
                                      value={model}
                                      onChange={(e) => handleUpdatePlaygroundModel(idx, e.target.value)}
                                      className="bg-transparent border-none text-xs text-on-surface font-extrabold focus:outline-none focus:ring-0 cursor-pointer p-0 max-w-[150px] truncate"
                                    >
                                      {installedModels.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                  ) : (
                                    <span className="text-xs text-on-surface font-extrabold">{model}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {status === 'streaming' ? (
                                    <span className="text-[9px] text-primary px-1.5 py-0.5 rounded bg-primary/10 animate-pulse font-semibold">Streaming</span>
                                  ) : status === 'done' ? (
                                    <span className="text-[9px] text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-950/20 font-bold border border-emerald-500/10">Finished</span>
                                  ) : null}
                                  {playgroundModels.length > 1 && (
                                    <button
                                      onClick={() => handleRemovePlaygroundColumn(idx)}
                                      className="text-on-surface-variant hover:text-rose-400 font-bold text-xs p-1 cursor-pointer transition-colors"
                                      title="Remove target model"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Column streamed text viewer */}
                              <div className="flex-1 p-4 font-mono text-xs text-left leading-relaxed text-slate-200 overflow-y-auto whitespace-pre-wrap select-text select-all">
                                {output ? (
                                  output
                                ) : (
                                  <span className="text-on-surface-variant/35 italic select-none">
                                    {status === 'streaming' ? 'Establishing connection...' : 'Awaiting comparison execute...'}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: Version History & Comparison Diffs */}
                  {activeTab === 'history' && store.activePrompt && (
                    <div className="flex-1 flex flex-col gap-6">
                      <div>
                        <h3 className="text-[15px] font-bold text-on-surface mb-1 flex items-center gap-2">
                          <span>⌛</span> Version History & Auditor
                        </h3>
                        <p className="text-xs text-on-surface-variant">
                          Select a past commit version to display differences against your active editor changes.
                        </p>
                      </div>

                      <div className="grid grid-cols-[240px_1fr] gap-6 flex-1 min-h-[300px]">
                        <div className="border border-white/10 rounded-xl bg-surface-container-low/40 p-2 overflow-y-auto space-y-1">
                          {store.activePrompt.versions.map((ver) => {
                            const isLatest = ver.versionNumber === store.activePrompt?.latestVersion.versionNumber;
                            const isComparing = compareVersionId === ver.id;
                            return (
                              <div
                                key={ver.id}
                                onClick={() => setCompareVersionId(ver.id)}
                                className={`p-3 rounded-lg cursor-pointer text-left transition-all border flex flex-col gap-1.5 ${isComparing
                                  ? 'bg-primary/10 border-primary'
                                  : 'hover:bg-white/5 border-transparent'
                                  }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className={`font-mono text-xs font-bold ${isComparing ? 'text-primary' : 'text-on-surface'}`}>
                                    Version {ver.versionNumber} {isLatest && <span className="text-[10px] bg-slate-800 text-slate-400 px-1 rounded ml-1">Latest</span>}
                                  </span>
                                  <span className="text-[9px] text-on-surface-variant/60">
                                    {new Date(ver.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                                <p className="text-[11px] text-on-surface-variant line-clamp-1 italic">
                                  "{ver.changeDescription || 'No description'}"
                                </p>
                                <div className="flex gap-2 mt-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm(`Are you sure you want to restore Version ${ver.versionNumber}?`)) {
                                        store.restoreVersion(store.activePromptId!, ver.versionNumber, ver.content);
                                      }
                                    }}
                                    className="text-[10px] text-primary hover:underline cursor-pointer"
                                  >
                                    Rollback Here
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex flex-col">
                          <h4 className="text-xs font-bold uppercase text-primary/70 tracking-wider mb-2 text-left">
                            {compareVersionId
                              ? `Changes Compared (Version ${store.activePrompt.versions.find(v => v.id === compareVersionId)?.versionNumber} vs Editor)`
                              : 'Select a version to show diffs'}
                          </h4>
                          {compareVersionId ? (
                            renderDiff()
                          ) : (
                            <div className="flex-1 border border-dashed border-white/10 rounded-xl flex items-center justify-center text-xs text-on-surface-variant/50">
                              Select a version commit on the left to review visual line modifications.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tags and Private Notes Fields */}
                  {(activeTab === 'editor' || isCreatingNew) && (
                    <div className="grid grid-cols-2 gap-4 shrink-0">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-on-surface-variant">Tags (Comma-separated)</label>
                        <input
                          type="text"
                          value={tagsInput}
                          onChange={(e) => handleFieldChange('tagsInput', e.target.value)}
                          placeholder="gpt-4, coding, analysis"
                          className="bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-0"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-on-surface-variant">Private Notes</label>
                        <textarea
                          value={notes}
                          onChange={(e) => handleFieldChange('notes', e.target.value)}
                          placeholder="Add reminders or constraints here..."
                          className="bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/40 h-10 resize-none focus:border-primary focus:outline-none focus:ring-0"
                        />
                      </div>
                    </div>
                  )}

                  {/* Save and Action Bar */}
                  {(activeTab === 'editor' || isCreatingNew) && (
                    <div className="flex items-center justify-between border-t border-white/10 pt-4 shrink-0">
                      <div className="flex gap-2">
                        <button
                          onClick={handleSave}
                          disabled={!hasUnsavedChanges || isGeneratingMeta || isImproving || isSaving}
                          className={`px-5 py-2 rounded-lg font-semibold text-sm cursor-pointer transition-all ${hasUnsavedChanges && !isGeneratingMeta && !isImproving && !isSaving
                            ? 'bg-gradient-to-r from-primary to-secondary text-slate-950 shadow-[0_0_15px_rgba(192,193,255,0.25)] hover:opacity-90'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                            }`}
                        >
                          {isSaving ? 'Saving...' : 'Save Prompt'}
                        </button>
                        {hasUnsavedChanges && (
                          <button
                            onClick={handleCancelEdit}
                            className="px-4 py-2 rounded-lg text-sm text-on-surface-variant hover:text-on-surface bg-white/5 transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 4th Column Collapsible Quality Analyzer Panel */}
              {showQualityPanel && content.trim().length > 0 && (
                <aside className="w-80 border-l border-white/10 bg-surface-container-lowest/40 backdrop-blur-2xl flex flex-col shrink-0 overflow-y-auto p-5 z-20">
                  <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
                    <h3 className="font-bold text-[15px] text-on-surface flex items-center gap-2">
                      <span>📊</span> Quality Audit
                    </h3>
                    <button
                      onClick={() => setShowQualityPanel(false)}
                      className="text-xs text-on-surface-variant hover:text-on-surface cursor-pointer"
                    >
                      Close ×
                    </button>
                  </div>

                  <div className="flex flex-col items-center justify-center p-4 bg-surface-variant/35 rounded-xl border border-white/5 mb-6 text-center">
                    <div className="relative w-24 h-24 flex items-center justify-center rounded-full bg-slate-900 border-4 border-slate-800 shadow-[0_0_15px_rgba(0,0,0,0.4)]">
                      <div className={`absolute inset-0.5 rounded-full opacity-20 filter blur-sm ${getScoreColor(qualityReport.overall)}`}></div>
                      <span className={`text-2xl font-extrabold font-mono tracking-tight ${qualityReport.overall >= 75 ? 'text-emerald-400' : qualityReport.overall >= 40 ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                        {qualityReport.overall}%
                      </span>
                    </div>
                    <span className="text-xs font-bold text-on-surface mt-3">Overall Prompt Quality</span>
                    <span className="text-[10px] text-on-surface-variant/80 mt-1 uppercase tracking-wider">
                      {qualityReport.overall >= 75 ? 'Excellent Structure' : qualityReport.overall >= 40 ? 'Needs Tweaking' : 'Weak Template'}
                    </span>
                  </div>

                  <div className="space-y-4 mb-6 text-left">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary/70">Structural Parameters</h4>

                    {[
                      { label: 'Clarity & Verbs', score: qualityReport.clarity },
                      { label: 'Role & Persona Context', score: qualityReport.context },
                      { label: 'Negative Constraints', score: qualityReport.constraints },
                      { label: 'Few-shot Examples', score: qualityReport.examples },
                      { label: 'Format Requirements', score: qualityReport.format }
                    ].map(metric => (
                      <div key={metric.label} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold text-on-surface-variant">
                          <span>{metric.label}</span>
                          <span className="font-mono">{metric.score}%</span>
                        </div>
                        <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                          <div className={`h-1.5 rounded-full ${getScoreColor(metric.score)}`} style={{ width: `${metric.score}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="text-left space-y-3 flex-1">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary/70">Improvement Suggestions</h4>
                    <div className="space-y-2">
                      {qualityReport.suggestions.map((sug, idx) => (
                        <div key={idx} className="flex gap-2 text-xs leading-relaxed text-on-surface-variant bg-surface-container-low/40 p-2.5 rounded-lg border border-white/5">
                          <span className="text-primary select-none mt-0.5">•</span>
                          <span>{sug}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </aside>
              )}
            </div>
          ) : (
            /* Empty State Screen */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-on-surface-variant/50">
              <div className="w-16 h-16 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center shadow-lg mb-6">
                <Icons.Terminal />
              </div>
              <h2 className="text-xl font-bold text-on-surface mb-2">Workspace Ready</h2>
              <p className="max-w-xs text-sm mb-6">
                Select an existing prompt template from the library or create a new template to start authoring.
              </p>
              <button
                onClick={handleCreateNewClick}
                className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all font-semibold text-sm py-2 px-6 rounded-lg cursor-pointer"
              >
                Create New Prompt
              </button>
            </div>
          )}
        </div>
      </main>

      {/* 4. MODALS & POPUPS */}

      {/* Settings Modal (Configuring Models names) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <form onSubmit={handleSaveSettings} className="card p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-2 text-on-surface text-left w-full">Application Configurations</h3>
            <p className="text-xs text-on-surface-variant mb-6 text-left w-full">
              Configure target Ollama models for suggestions and engineering improvements.
            </p>

            <div className="space-y-4 w-full mb-6 text-left">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant">Metadata Suggestions Model</label>
                {installedModels.length > 0 ? (
                  <select
                    value={settingsMetaModel}
                    onChange={(e) => setSettingsMetaModel(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                  >
                    {installedModels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={settingsMetaModel}
                    onChange={(e) => setSettingsMetaModel(e.target.value)}
                    placeholder="e.g. qwen3:14b"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                  />
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant">Prompt Improvement Model</label>
                {installedModels.length > 0 ? (
                  <select
                    value={settingsImproveModel}
                    onChange={(e) => setSettingsImproveModel(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                  >
                    {installedModels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={settingsImproveModel}
                    onChange={(e) => setSettingsImproveModel(e.target.value)}
                    placeholder="e.g. qwen3:coder"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                  />
                )}
              </div>

              {/* Vector embedding model selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant">Semantic Embedding Model</label>
                {installedModels.length > 0 ? (
                  <select
                    value={settingsEmbeddingModel}
                    onChange={(e) => setSettingsEmbeddingModel(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                  >
                    {installedModels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={settingsEmbeddingModel}
                    onChange={(e) => setSettingsEmbeddingModel(e.target.value)}
                    placeholder="e.g. embeddinggemma"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                  />
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 rounded-lg text-sm text-on-surface bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-slate-950 hover:opacity-90 transition-all cursor-pointer shadow-lg"
              >
                Save Config
              </button>
            </div>
          </form>
        </div>
      )}

      {/* AI Improvement Results Modal */}
      {showImproveModal && improvedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card p-6 w-full max-w-4xl flex flex-col max-h-[90vh]">
            <h3 className="text-lg font-bold mb-1 text-on-surface text-left">
              AI Improvement suggestions ({improvementAction.toUpperCase()})
            </h3>
            <p className="text-xs text-on-surface-variant mb-4 text-left">
              Review modifications suggested by the improvement agent below.
            </p>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-6 text-left">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase text-primary/70 tracking-wider">Report & Rationale</span>
                <div className="bg-slate-900/60 rounded-xl border border-white/5 p-4 text-xs text-slate-300 leading-relaxed italic whitespace-pre-wrap">
                  {improvedResult.explanation}
                </div>
              </div>

              {improvementAction !== 'explain' && improvementAction !== 'check_ambiguity' && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase text-primary/70 tracking-wider">Improved Content</span>
                  <textarea
                    value={improvedResult.improvedContent}
                    readOnly
                    className="w-full h-[450px] editor-bg rounded-xl border border-outline-variant p-4 font-mono text-xs text-slate-200 resize-none focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 shrink-0">
              <button
                onClick={() => {
                  setShowImproveModal(false);
                  setImprovedResult(null);
                }}
                className="px-4 py-2 rounded-lg text-sm text-on-surface bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
              >
                Discard
              </button>
              {improvementAction !== 'explain' && improvementAction !== 'check_ambiguity' && (
                <button
                  onClick={handleApplyImprovement}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-slate-950 hover:opacity-90 transition-all cursor-pointer shadow-lg"
                >
                  Accept & Replace
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Semantic Duplicate Warning Modal */}
      {showDuplicateWarning && duplicateWarningData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card p-6 w-full max-w-md border-amber-500/35">
            <div className="flex items-center gap-3 text-amber-400 mb-3">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-lg font-bold text-on-surface">Semantic Duplicate Warning!</h3>
            </div>

            <p className="text-xs text-on-surface-variant mb-4 text-left leading-relaxed">
              This prompt template matches the behavior of an existing prompt:
              <strong className="text-on-surface block mt-1">"{duplicateWarningData.duplicateOfTitle}"</strong>
            </p>

            <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-200/90 leading-relaxed text-left mb-6 whitespace-pre-wrap">
              <strong>Match Reason:</strong><br />
              {duplicateWarningData.reason}
            </div>

            <div className="flex justify-end gap-2 w-full">
              <button
                onClick={() => setShowDuplicateWarning(false)}
                className="px-4 py-2 rounded-lg text-sm text-on-surface bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
              >
                Cancel and Edit
              </button>
              <button
                onClick={duplicateWarningData.proceed}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all cursor-pointer shadow-lg"
              >
                Save Duplicate Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <form onSubmit={handleCreateFolder} className="card p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4 text-on-surface text-left w-full">Create New Category Folder</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="e.g. Code Generation, Writing Helpers"
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-0 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => {
                  setNewFolderName('');
                  setShowFolderModal(false);
                }}
                className="px-4 py-2 rounded-lg text-sm text-on-surface bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-slate-950 hover:opacity-90 transition-all cursor-pointer shadow-lg"
              >
                Create Folder
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Collection Modal */}
      {showColModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <form onSubmit={handleCreateCollection} className="card p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4 text-on-surface text-left w-full">Create New Collection</h3>
            <div className="space-y-3 w-full mb-4">
              <input
                type="text"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                placeholder="Collection Name"
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-0"
                autoFocus
              />
              <input
                type="text"
                value={newColDesc}
                onChange={(e) => setNewColDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-0"
              />
            </div>
            <div className="flex justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => {
                  setNewColName('');
                  setNewColDesc('');
                  setShowColModal(false);
                }}
                className="px-4 py-2 rounded-lg text-sm text-on-surface bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-slate-950 hover:opacity-90 transition-all cursor-pointer shadow-lg"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}
      {/* AI Prompt Generator Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card p-6 w-full max-w-md flex flex-col border border-white/10 shadow-2xl bg-surface-container">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4 shrink-0">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <Icons.Sparkles /> AI Prompt Generator
              </h3>
            </div>

            <div className="space-y-4 pr-1 mb-6 text-left">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-on-surface-variant">Describe what you need the prompt to do:</label>
                <textarea
                  value={generatePromptInput}
                  onChange={(e) => setGeneratePromptInput(e.target.value)}
                  placeholder="e.g. Necesito un prompt para que la IA audite mi proyecto, o write a python script optimizer..."
                  disabled={isGeneratingPrompt}
                  className="w-full h-28 bg-surface-container-low border border-outline-variant rounded-xl p-3 text-sm text-on-surface placeholder:text-on-surface-variant/40 resize-none focus:border-primary focus:outline-none focus:ring-0 disabled:opacity-50"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 shrink-0 pt-4 border-t border-white/5">
              <button
                onClick={() => {
                  setShowGenerateModal(false);
                  setGeneratePromptInput('');
                }}
                disabled={isGeneratingPrompt}
                className="px-4 py-2 rounded-lg text-sm text-on-surface bg-white/5 hover:bg-white/10 transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleGeneratePrompt}
                disabled={isGeneratingPrompt || !generatePromptInput.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-primary to-secondary text-slate-950 hover:opacity-90 transition-all cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGeneratingPrompt ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                    Generating...
                  </>
                ) : (
                  <>
                    <Icons.Sparkles />
                    Generate & Add
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
