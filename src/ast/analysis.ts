import { FunctionDeclaration, Identifier, Program } from "acorn";
import MagicString from "magic-string";
import { InnerStatement } from "src/module";
import { Scope } from "./scope";
import { walk } from "./walk";

const addToScope = (
  node: FunctionDeclaration,
  scope: Scope,
  statement: InnerStatement
) => {
  scope.add(node.id.name);
  if (!scope.parent) {
    statement._defines[node.id.name] = true; // 全局变量
  }
};

export const analyze = (ast: Program, code: MagicString) => {
  let scope = new Scope({ name: "root" });

  ast.body.forEach((statement) => {
    Object.defineProperties(statement, {
      _defines: {
        value: {},
      }, // 当前模块使用的全局变量
      _dependsOn: {
        value: {},
      }, // 当前模块没有定义却使用的变量，外部变量
      _included: {
        value: false,
        writable: true,
      },
      _source: {
        value: code.snip(statement.start, statement.end),
      },
    });

    walk(statement, {
      enter: (node, parent) => {
        let newScope;
        switch (node.type) {
          case "FunctionDeclaration":
            const params = node.params.map((param: Identifier) => param.name);
            addToScope(
              node as FunctionDeclaration,
              scope,
              statement as InnerStatement
            );
            newScope = new Scope({
              name: node.id.name,
              parent: scope,
              params,
            });
            break;
          case "VariableDeclaration":
            node.declarations.forEach((declaration) => {
              addToScope(
                declaration as unknown as FunctionDeclaration,
                scope,
                statement as InnerStatement
              );
            });
        }

        if (newScope) {
          Object.defineProperty(node, "_scope", { value: newScope });
          scope = newScope;
        }
      },
    });

    leave: (node) => {
      scope = scope.parent;
    };
  });

  ast.body.forEach((statement: InnerStatement) => {
    walk(statement, {
      enter: (node) => {
        // @ts-ignore
        if (node._scope) scope = node._scope;
        if (node.type === "Identifier") {
          const definingScope = scope.findDefiningScope(node.name);
          if (definingScope) {
            statement._dependsOn[node.name] = true;
          }
        }
      },
      leave: (node) => {
        // @ts-ignore
        if (node._scope) scope = scope.parent;
      },
    });
  });
};
