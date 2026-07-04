import { Category } from './Category';
import { Tag } from './Tag';

export class Prompt {
  constructor(
    public id: string,
    public title: string,
    public description: string,
    public categoryId: string | null,
    public notes: string,
    public isArchived: boolean = false,
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    // Associations (optional loading)
    public tags: Tag[] = [],
    public category: Category | null = null
  ) {}
}
