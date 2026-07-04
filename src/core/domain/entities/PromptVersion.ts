export class PromptVersion {
  constructor(
    public id: string,
    public promptId: string,
    public versionNumber: number,
    public content: string,
    public changeDescription: string = '',
    public embedding: Float32Array | null = null,
    public embeddingModel: string | null = null,
    public createdAt: Date = new Date()
  ) {}
}
