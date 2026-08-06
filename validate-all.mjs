#!/usr/bin/env node
/**
 * Full-repo dep-graph validation for the Uber-like demo monorepo.
 * Self-contained — dep-graph.js is bundled alongside this script.
 *
 * Usage:
 *   node validate-all.mjs [repo-root]
 *
 * Includes Go multi-module go.mod discovery, BUILD.bazel parsing, and nested
 * Java source root resolution (PR #809, after v0.10.58).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const REPO_ROOT = process.argv[2] ?? new URL('.', import.meta.url).pathname;


const { buildDepGraph } = await import(new URL('./codeledger-lib/dep-graph.js', import.meta.url));

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.codeledger']);
const CODE_EXTS = new Set(['.go', '.java', '.kt', '.ts', '.tsx', '.js', '.py', '.rs']);
const LANG_MAP = {
  '.go': 'go', '.java': 'java', '.kt': 'kotlin',
  '.ts': 'typescript', '.tsx': 'typescript',
  '.js': 'javascript', '.py': 'python', '.rs': 'rust',
};

function walk(dir, base = dir) {
  const infos = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      infos.push(...walk(full, base));
    } else if (CODE_EXTS.has(extname(entry))) {
      const relPath = relative(base, full).replace(/\\/g, '/');
      const content = readFileSync(full, 'utf-8');
      const lines = content.split('\n').length;
      infos.push({
        path: relPath,
        language: LANG_MAP[extname(entry)] ?? 'unknown',
        size: stat.size,
        lines,
        tokens: Math.ceil(lines * 3.5),
        content,
      });
    }
  }
  return infos;
}

const files = walk(REPO_ROOT);
console.log(`\nRepo: ${REPO_ROOT}`);
console.log(`Total indexed files: ${files.length}`);

const byLang = {};
for (const f of files) byLang[f.language] = (byLang[f.language] ?? 0) + 1;
for (const [lang, count] of Object.entries(byLang).sort())
  console.log(`  ${lang.padEnd(12)} ${count} files`);

const graph = buildDepGraph(REPO_ROOT, files);

let totalEdges = 0, filesWithEdges = 0;
const depCounts = {};
for (const [src, targets] of Object.entries(graph.imports ?? {})) {
  if (targets.length > 0) { totalEdges += targets.length; filesWithEdges++; }
  for (const t of targets) depCounts[t] = (depCounts[t] ?? 0) + 1;
}

console.log(`\nTotal edges resolved:     ${totalEdges}`);
console.log(`Files with outgoing deps: ${filesWithEdges}`);

const goEdges = Object.entries(graph.imports ?? {})
  .filter(([s]) => s.endsWith('.go')).reduce((s, [, ts]) => s + ts.length, 0);
const javaEdges = Object.entries(graph.imports ?? {})
  .filter(([s]) => s.endsWith('.java')).reduce((s, [, ts]) => s + ts.length, 0);
console.log(`Go edges:  ${goEdges}`);
console.log(`Java edges: ${javaEdges}`);

const sample = Object.entries(graph.imports ?? {})
  .filter(([s]) => s.endsWith('.go')).slice(0, 5);
if (sample.length) {
  console.log('\nGo edge sample:');
  for (const [src, ts] of sample) console.log(`  ${src}\n    → ${ts[0]}`);
}

const jSample = Object.entries(graph.imports ?? {})
  .filter(([s]) => s.endsWith('.java') && graph.imports[s]?.length);
if (jSample.length) {
  console.log('\nJava edges:');
  for (const [src, ts] of jSample.slice(0, 6))
    for (const t of ts) console.log(`  ${src.split('/').pop()} → ${t.split('/').pop()}`);
}

const top = Object.entries(depCounts).sort(([, a], [, b]) => b - a).slice(0, 5);
if (top.length) {
  console.log('\nMost-imported (hub files):');
  for (const [p, c] of top) console.log(`  ${c.toString().padStart(3)}  ${p}`);
}

const crossPkg = Object.entries(graph.imports ?? {}).flatMap(([src, ts]) =>
  ts.filter(t => src.split('/').slice(0,-1).join('/') !== t.split('/').slice(0,-1).join('/')));
console.log(`\nCross-package edges: ${crossPkg.length} / ${totalEdges} (${totalEdges ? Math.round(crossPkg.length/totalEdges*100) : 0}%)`);

const services = ['services/auth','services/pricing','services/matching','services/dispatch','shared','java-services'];
console.log('\nEdges by service:');
for (const svc of services) {
  const e = Object.entries(graph.imports ?? {})
    .filter(([s]) => s.startsWith(svc)).reduce((s, [, ts]) => s + ts.length, 0);
  const f = files.filter(f => f.path.startsWith(svc)).length;
  console.log(`  ${svc.padEnd(32)} ${e.toString().padStart(3)} edges  (${f} files)`);
}
