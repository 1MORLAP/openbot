/**
 * Metro does not tree-shake, so `import { Hash } from "lucide-react-native"` bundles the whole
 * icon set: about 1,800 modules, 1.3 MB of JavaScript that runs at startup. This Babel plugin
 * rewrites each icon import to the package's own per-icon entry point (`lucide-react-native/icons/hash`)
 * and leaves everything else in the import alone. The name to file map is read from the package's
 * barrel file, so aliases such as `Layers3` resolve exactly as the barrel resolves them.
 */
const fs = require("node:fs");
const path = require("node:path");

const PACKAGE = "lucide-react-native";
const EXPORT_LINE = /^export \{([^}]+)\} from '\.\/icons\/([^']+)\.mjs';$/;

let iconFiles = null;

function loadIconFiles() {
  if (iconFiles) return iconFiles;
  // The package does not export its package.json, so start from its CommonJS entry (dist/cjs).
  const barrel = path.join(path.dirname(require.resolve(PACKAGE)), "../esm/lucide-react-native.mjs");
  iconFiles = new Map();
  for (const line of fs.readFileSync(barrel, "utf8").split("\n")) {
    const match = EXPORT_LINE.exec(line);
    if (!match) continue;
    for (const part of match[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/)[1];
      if (name) iconFiles.set(name, match[2]);
    }
  }
  return iconFiles;
}

module.exports = function lucideDeepImports({ types: t }) {
  return {
    name: "lucide-deep-imports",
    visitor: {
      ImportDeclaration(declaration) {
        const node = declaration.node;
        if (node.source.value !== PACKAGE || node.importKind === "type") return;
        const files = loadIconFiles();
        const kept = [];
        const rewritten = [];
        for (const specifier of node.specifiers) {
          const file =
            t.isImportSpecifier(specifier) && specifier.importKind !== "type"
              ? files.get(t.isIdentifier(specifier.imported) ? specifier.imported.name : specifier.imported.value)
              : undefined;
          if (file) {
            rewritten.push(
              t.importDeclaration(
                [t.importDefaultSpecifier(t.identifier(specifier.local.name))],
                t.stringLiteral(`${PACKAGE}/icons/${file}`),
              ),
            );
          } else {
            kept.push(specifier);
          }
        }
        if (!rewritten.length) return;
        if (kept.length) {
          node.specifiers = kept;
          declaration.insertAfter(rewritten);
        } else {
          declaration.replaceWithMultiple(rewritten);
        }
      },
    },
  };
};
