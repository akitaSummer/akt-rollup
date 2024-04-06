export class Scope {
  name: string;
  parent: Scope | undefined;
  params: string[];

  constructor({
    name,
    parent,
    params,
  }: {
    name: string;
    parent?: Scope;
    params?: string[];
  }) {
    this.name = name;
    this.parent = parent; // 父作用域
    this.params = params || [];
  }

  add(name: string) {
    this.params.push(name);
  }

  findDefiningScope(name: string) {
    if (this.params.includes(name)) {
      return this;
    }

    if (this.parent) {
      return this.parent.findDefiningScope(name);
    }

    return null;
  }
}
