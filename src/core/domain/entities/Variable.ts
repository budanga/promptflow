export class Variable {
  constructor(
    public id: string,
    public name: string,
    public description: string = '',
    public defaultValue: string = ''
  ) {}
}
