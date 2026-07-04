export class Category {
  constructor(
    public id: string,
    public name: string,
    public parentId: string | null = null,
    public createdAt: Date = new Date()
  ) {}
}
