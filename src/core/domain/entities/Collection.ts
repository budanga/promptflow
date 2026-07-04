export class Collection {
  constructor(
    public id: string,
    public name: string,
    public description: string = '',
    public createdAt: Date = new Date()
  ) {}
}
