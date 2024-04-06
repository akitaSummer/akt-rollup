import { Identifier } from "acorn";
import { InnerStatement } from "src/module";

type InputNode = InnerStatement;

type ContentNode = InnerStatement | Identifier;

const visit = (
  node: InputNode,
  parent?: InputNode,
  enter?: (node: ContentNode, parent?: InputNode) => void,
  leave?: (node: ContentNode, parent?: InputNode) => void
) => {
  if (enter) {
    enter(node, parent);
  }
  const childKeys = Object.keys(node).filter(
    (key) => typeof node[key] === "object"
  );

  childKeys.forEach((key) => {
    const child = node[key];
    if (Array.isArray(child)) {
      child.forEach((child) => {
        visit(child, node, enter, leave);
      });
    } else {
      visit(child, node, enter, leave);
    }
  });

  if (leave) {
    leave(node, parent);
  }
};

export const walk = (
  node: InputNode,
  {
    enter,
    leave,
  }: {
    enter?: (node: ContentNode, parent?: InputNode) => void;
    leave?: (node: ContentNode, parent?: InputNode) => void;
  }
) => {
  visit(node, undefined, enter, leave);
};
