import ts from 'typescript';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { Plugin } from 'vite';
import type { SampleDiscovery } from '../src/samples/metadataTypes';

// Build-time only: extract the three display strings, never import or execute
// an example. Calls, getters, spreads and interpolation are not literal data.
function literalString(node: ts.Expression): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isParenthesizedExpression(node)) return literalString(node.expression);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = literalString(node.left);
    const right = literalString(node.right);
    return left === undefined || right === undefined ? undefined : left + right;
  }
  return undefined;
}

function exported(node: ts.FunctionDeclaration | ts.VariableStatement): boolean {
  return node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

export function discoverExample(source: string, filename: string): SampleDiscovery {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const hasRun = file.statements.some(statement =>
    ts.isFunctionDeclaration(statement) && exported(statement) && statement.name?.text === 'run' ||
    ts.isVariableStatement(statement) && exported(statement) && statement.declarationList.declarations.some(declaration =>
      ts.isIdentifier(declaration.name) && declaration.name.text === 'run' && declaration.initializer !== undefined &&
      (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))));
  const cliOnly = { kind: 'cli-only', reason: 'No exported run() entry point; use the example’s CLI instructions.' } as const;

  let initializer: ts.Expression | undefined;
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement) || !exported(statement)) continue;
    const declaration = statement.declarationList.declarations.find(value => ts.isIdentifier(value.name) && value.name.text === 'meta');
    if (declaration) initializer = declaration.initializer;
  }
  while (initializer && (ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer) || ts.isParenthesizedExpression(initializer))) {
    initializer = initializer.expression;
  }
  if (!initializer || !ts.isObjectLiteralExpression(initializer)) {
    if (!hasRun) return cliOnly;
    return { kind: 'unsupported', reason: 'Export a literal meta object to list this runnable example.' };
  }
  const fields = new Map<string, string>();
  const required = new Set(['id', 'title', 'description']);
  for (const property of initializer.properties) {
    if (ts.isSpreadAssignment(property) || (property.name && ts.isComputedPropertyName(property.name))) {
      return { kind: 'unsupported', reason: 'Catalog metadata cannot contain spreads or computed property names.' };
    }
    const name = property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) ? property.name.text : undefined;
    if (name && required.has(name) && (!ts.isPropertyAssignment(property) || fields.has(name))) {
      return { kind: 'unsupported', reason: 'Catalog display fields must have one literal declaration, without accessors or overrides.' };
    }
    if (!ts.isPropertyAssignment(property) || name === undefined) continue;
    const value = literalString(property.initializer);
    if (required.has(name) && value === undefined) return { kind: 'unsupported', reason: 'Catalog display fields must be literal strings.' };
    if (value !== undefined) fields.set(name, value);
  }
  const id = fields.get('id');
  const title = fields.get('title');
  const description = fields.get('description');
  if (!id || !title || !description) return !hasRun ? cliOnly : { kind: 'unsupported', reason: 'Catalog id, title and description must be non-empty literal strings.' };
  // Folder is the existing URL-mode contract, even when meta.group is absent.
  const group = path.basename(path.dirname(filename));
  const meta = { id, title, description, group };
  return hasRun ? { kind: 'runnable', meta } : { ...cliOnly, meta };
}

/** Vite emits inert JSON metadata; TypeScript and example code stay out of the browser bundle. */
export function exampleMetadataPlugin(samplesDirectory: string): Plugin {
  return {
    name: 'example-metadata',
    enforce: 'pre',
    async load(id) {
      const suffix = '?sample-meta';
      if (!id.endsWith(suffix)) return;
      const filename = id.slice(0, -suffix.length);
      const relative = path.relative(samplesDirectory, filename);
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Example metadata must come from the configured samples directory.');
      return `export default ${JSON.stringify(discoverExample(await readFile(filename, 'utf8'), filename))};`;
    },
  };
}
