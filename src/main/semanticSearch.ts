import { IPromptRepository } from '../core/domain/repositories/IPromptRepository';
import { IAIService } from '../core/domain/services/IAIService';
import { PromptVersion } from '../shared/types';

interface IndexedVersion {
  promptId: string;
  versionId: string;
  embedding: Float32Array;
  model: string;
}

export class SemanticSearchIndex {
  private index: IndexedVersion[] = [];

  async initialize(promptRepo: IPromptRepository): Promise<void> {
    try {
      const versions = await promptRepo.listAllVersions();
      this.index = versions
        .filter(v => v.embedding !== null && v.embeddingModel !== null)
        .map(v => ({
          promptId: v.promptId,
          versionId: v.id,
          embedding: v.embedding as Float32Array,
          model: v.embeddingModel as string
        }));
      console.log(`Semantic Search Index initialized with ${this.index.length} cached vectors.`);
    } catch (error) {
      console.error('Failed to initialize Semantic Search Index:', error);
    }
  }

  updateVersion(promptId: string, versionId: string, embedding: Float32Array, model: string): void {
    // Remove if already exists
    this.index = this.index.filter(v => v.versionId !== versionId);
    
    // Add new vector
    this.index.push({
      promptId,
      versionId,
      embedding,
      model
    });
  }

  removePrompt(promptId: string): void {
    this.index = this.index.filter(v => v.promptId !== promptId);
  }

  search(queryVector: number[], targetModel: string, topK = 5): Array<{ promptId: string; similarity: number }> {
    // 1. Convert query vector to Float32Array and L2-normalize
    const query = new Float32Array(queryVector);
    const queryNorm = this.l2Norm(query);
    
    if (queryNorm === 0) return [];

    // Filter index for vectors matching the target model name
    const activeIndex = this.index.filter(v => v.model === targetModel);

    // 2. Compute similarity for each item in the active index
    const matches = activeIndex.map(item => {
      const dot = this.dotProduct(query, item.embedding);
      const itemNorm = this.l2Norm(item.embedding);
      
      const similarity = itemNorm === 0 ? 0 : dot / (queryNorm * itemNorm);
      
      return {
        promptId: item.promptId,
        similarity
      };
    });

    // 3. Deduplicate by promptId (keeping the highest similarity version for each prompt)
    const bestMatchesMap: Record<string, number> = {};
    for (const match of matches) {
      if (bestMatchesMap[match.promptId] === undefined || match.similarity > bestMatchesMap[match.promptId]) {
        bestMatchesMap[match.promptId] = match.similarity;
      }
    }

    // 4. Sort descending and slice topK
    return Object.entries(bestMatchesMap)
      .map(([promptId, similarity]) => ({ promptId, similarity }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  async checkIndexStatus(promptRepo: IPromptRepository, targetModel: string): Promise<{ isStale: boolean; staleCount: number }> {
    try {
      const versions = await promptRepo.listAllVersions();
      const staleVersions = versions.filter(v => v.embeddingModel !== targetModel || v.embedding === null);
      
      return {
        isStale: staleVersions.length > 0,
        staleCount: staleVersions.length
      };
    } catch {
      return { isStale: false, staleCount: 0 };
    }
  }

  async rebuild(
    promptRepo: IPromptRepository,
    aiService: IAIService,
    targetModel: string,
    onProgress: (percent: number, current: number, total: number) => void
  ): Promise<boolean> {
    try {
      console.log(`Rebuilding Semantic Search Index with model: ${targetModel}...`);
      const versions = await promptRepo.listAllVersions();
      const total = versions.length;
      
      if (total === 0) {
        onProgress(100, 0, 0);
        return true;
      }

      // Clear current index
      this.index = [];

      for (let i = 0; i < total; i++) {
        const v = versions[i];
        try {
          // Generate embedding offline via Ollama
          const vector = await aiService.embed(v.content, targetModel);
          if (vector.length > 0) {
            const floatArray = new Float32Array(vector);
            await promptRepo.saveVersionEmbedding(v.id, floatArray, targetModel);
            this.updateVersion(v.promptId, v.id, floatArray, targetModel);
          }
        } catch (err) {
          console.error(`Failed to generate embedding for version ${v.id}:`, err);
        }
        
        const percent = Math.round(((i + 1) / total) * 100);
        onProgress(percent, i + 1, total);
      }

      console.log(`Semantic Search Index rebuilt successfully with ${this.index.length} vectors.`);
      return true;
    } catch (error) {
      console.error('Failed to rebuild semantic search index:', error);
      return false;
    }
  }

  // Linear Algebra Helpers
  private dotProduct(a: Float32Array, b: Float32Array): number {
    let dot = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
    }
    return dot;
  }

  private l2Norm(a: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * a[i];
    }
    return Math.sqrt(sum);
  }
}
