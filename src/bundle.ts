import fs from "node:fs/promises";
import { InnerStatement, Module } from "./module";
import { Bundle as MagicStringBundle } from "magic-string";

export class Bundle {
  entry: string;
  statements: InnerStatement[] = [];
  constructor({ entry }: { entry: string }) {
    this.entry = entry;
  }

  async build(outputFilename: string) {
    const entryModules = await this.fetchMoudules(this.entry);
    // 入口模块所有语句展开，生成一个数组
    this.statements = await entryModules.expandAllStatements();

    const { code } = this.generate();
    await fs.writeFile(outputFilename, code, "utf-8");
  }

  async fetchMoudules(filename: string) {
    const code = await fs.readFile(filename, "utf-8");
    return new Module({ path: filename, code, bundle: this });
  }

  generate() {
    const magicString = new MagicStringBundle({
      separator: "\n",
    });

    this.statements.forEach((statement) => {
      const source = statement._source.clone();
      if (statement.type === "ExportNamedDeclaration") {
        source.remove(statement.start, statement.declaration.start);
      }

      magicString.addSource({
        content: source,
      });
    });

    return { code: magicString.toString() };
  }
}
