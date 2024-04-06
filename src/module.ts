import path from "node:path";
import MagicString from "magic-string";
import {
  ExportNamedDeclaration,
  Identifier,
  ImportSpecifier,
  ModuleDeclaration,
  parse,
  Program,
  Statement,
  VariableDeclaration,
} from "acorn";
import { Bundle } from "./bundle";
import { analyze } from "./ast/analysis";
import { Scope } from "./ast/scope";

const hasOwnProperty = (obj: Object, props: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(obj, props);

export type InnerStatement = (Statement | ModuleDeclaration) & {
  _included?: boolean;
  _defines?: Record<string, boolean>;
  _dependsOn?: Record<string, boolean>;
  _scope?: Scope;
  _source?: MagicString;
};

export class Module {
  path: string;
  code: MagicString;
  bundle: Bundle;
  ast: Program;
  definitions: Record<string, InnerStatement> = {};

  imports: Record<string, { name: string; localName: string; source: string }> =
    {};
  exports: Record<
    string,
    {
      node: ExportNamedDeclaration;
      localName: string;
      expression: VariableDeclaration;
    }
  > = {};

  constructor({
    path,
    code,
    bundle,
  }: {
    path: string;
    code: string;
    bundle: Bundle;
  }) {
    this.path = path;
    this.ast = parse(code, {
      ecmaVersion: 7,
      sourceType: "module",
    });
    this.bundle = bundle;
  }

  analysis() {
    this.imports = {};
    this.exports = {};

    this.ast.body.forEach((statement) => {
      if (statement.type === "ImportDeclaration") {
        const source = statement.source.value as string;
        const specifiers = statement.specifiers;
        specifiers.forEach((specifier: ImportSpecifier) => {
          const name = (specifier.imported as Identifier).name;
          const localName = specifier.local.name;
          this.imports[localName] = { name, localName, source };
        });
      } else if (statement.type === "ExportNamedDeclaration") {
        const declaration = statement.declaration;
        if (declaration.type === "VariableDeclaration") {
          const name = (declaration.declarations[0].id as Identifier).name;
          this.exports[name] = {
            node: statement,
            localName: name,
            expression: declaration,
          };
        }
      }
    });

    analyze(this.ast, this.code);

    this.ast.body.forEach((statement: InnerStatement) => {
      Object.keys(statement._defines).forEach((name) => {
        this.definitions[name] = statement;
      });
    });
  }

  async expandAllStatements() {
    let allStatements = [];
    for (let i = 0; i < this.ast.body.length; i++) {
      const statement = this.ast.body[i];
      const statements = await this.expandStatements(
        statement as InnerStatement
      );
      allStatements.push(...statements);
    }
    return allStatements;
  }

  // 找到依赖的变量，找到声明语句，可能是当前模块的声明，也可能也是引入模块
  async expandStatements(statement: InnerStatement) {
    const result = [];
    const dependencies = Object.keys(statement._dependsOn);
    for (let i = 0; i < dependencies.length; i++) {
      const name = dependencies[i];
      const definition = await this.define(name);
      if (definition) {
        result.push(definition);
      }
    }
    if (!statement._included) {
      // 已经被处理过了
      statement._included = true;
      result.push(statement);
    }

    return result;
  }

  async define(name: string) {
    if (hasOwnProperty(this.imports, name)) {
      const ImportDeclaration = this.imports[name];
      const module = await this.bundle.fetchMoudules(
        path.resolve(path.dirname(this.path), ImportDeclaration.source)
      );

      const exportData = module.exports[ImportDeclaration.name];

      // 递归把素有导出都取出来
      return module.define(exportData.localName);
    } else {
      const statement = this.definitions[name];

      if (statement && !statement._included) {
        return this.expandStatements(statement);
      } else {
        return [];
      }
    }
  }
}
