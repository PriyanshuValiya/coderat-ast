import express from "express";
import cors from "cors";
import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";

const { typescript } = TypeScript;

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

function parse(code, lang) {
  const parser = new Parser();
  parser.setLanguage(lang === "ts" || lang === "tsx" ? typescript : JavaScript);
  return parser.parse(code);
}

function extractSymbols(tree, source) {
  const symbols = [];
  const handledNodes = new Set();

  function walk(node) {
    if (node.type === "call_expression") {
      const fn = node.childForFieldName("function");
      const args = node.childForFieldName("arguments");

      if (fn && args && fn.text.startsWith("app.")) {
        const method = fn.text.replace("app.", "").toUpperCase();

        const routeNode = args.namedChildren.find(
          (n) => n.type === "string"
        );

        const route =
          routeNode?.text?.replace(/['"`]/g, "") ?? "/";

        args.namedChildren.forEach((child) => {
          if (
            child.type === "arrow_function" ||
            child.type === "function_expression"
          ) {
            symbols.push({
              type: "function",
              name: `${method} ${route}`,
              code: source.slice(child.startIndex, child.endIndex),
              startLine: child.startPosition.row + 1,
              endLine: child.endPosition.row + 1,
            });

            handledNodes.add(child.id);
          }
        });
      }
    }

    if (node.type === "function_declaration") {
      const nameNode = node.childForFieldName("name");
      if (nameNode) {
        symbols.push({
          type: "function",
          name: nameNode.text,
          code: source.slice(node.startIndex, node.endIndex),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
        });
      }
    }

    if (
      (node.type === "arrow_function" ||
        node.type === "function_expression") &&
      !handledNodes.has(node.id)
    ) {
      const parent = node.parent;
      if (parent?.type === "variable_declarator") {
        const nameNode = parent.childForFieldName("name");
        if (nameNode) {
          symbols.push({
            type: "function",
            name: nameNode.text,
            code: source.slice(node.startIndex, node.endIndex),
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
          });
        }
      }
    }

    if (node.type === "class_declaration") {
      const nameNode = node.childForFieldName("name");
      if (nameNode) {
        symbols.push({
          type: "class",
          name: nameNode.text,
          code: source.slice(node.startIndex, node.endIndex),
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
        });
      }
    }

    node.children.forEach(walk);
  }

  walk(tree.rootNode);
  return symbols;
}


app.post("/parse", (req, res) => {
  console.log("AST Service triggered");
  const { code, extension } = req.body;

  if (!code || !extension) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    const tree = parse(code, extension);
    const symbols = extractSymbols(tree, code);

    res.json({ symbols });
  } catch (err) {
    console.error("AST parse failed:", err);
    res.status(500).json({ error: "AST parse failed" });
  }
});

app.get("/", (req, res) => {
  res.send("AST Service is running");
});

app.listen(4000, () => {
  console.log("AST service running on port 4000");
});