#!/usr/bin/env node
/**
 * Full-repo dep-graph validation for the Uber-like demo monorepo.
 * Feeds Go, Java, and all other indexed files to buildDepGraph.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = process.argv[2] ?? '/tmp/uber-demo';
const CL_ROOT = process.argv[3] ?? '/home/user/codeledger-blackbox';

// Load buildDepGraph from built dist
const { buildDepGraph } = await import(join(CL_ROOT, 'packages/repo/dist/dep-graph.js'));

// ── File walker ──────────────────────────────────────────────────────────────
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

// ── Run ──────────────────────────────────────────────────────────────────────
const files = walk(REPO_ROOT);
console.log(`\nRepo: ${REPO_ROOT}`);
console.log(`Total indexed files: ${files.length}`);

const byLang = {};
for (const f of files) byLang[f.language] = (byLang[f.language] ?? 0) + 1;
for (const [lang, count] of Object.entries(byLang).sort()) {
  console.log(`  ${lang.padEnd(12)} ${count} files`);
}
console.log('');

const graph = buildDepGraph(REPO_ROOT, files);

// Count edges
let totalEdges = 0;
let filesWithEdges = 0;
const depCounts = {}; // target → how many files import it

for (const [src, targets] of Object.entries(graph.imports ?? {})) {
  if (targets.length > 0) {
    totalEdges += targets.length;
    filesWithEdges++;
    for (const t of targets) {
      depCounts[t] = (depCounts[t] ?? 0) + 1;
    }
  }
}

console.log(`Total edges resolved:    ${totalEdges}`);
console.log(`Files with outgoing deps: ${filesWithEdges}`);

// DI interface detection
const diFiles = Object.entries(graph.imports ?? {}).filter(([, targets]) =>
  targets.some(t => t.includes('Interface') || t.includes('I') && t.match(/\/I[A-Z]/))
);
if (diFiles.length > 0) {
  console.log(`\nDI-style edges (interface→impl):`);
  for (const [src, targets] of diFiles) {
    for (const t of targets) console.log(`  ${src} → ${t}`);
  }
} else {
  // Show any Java edges
  const javaEdges = Object.entries(graph.imports ?? {}).filter(([src]) => src.endsWith('.java'));
  if (javaEdges.length > 0) {
    console.log(`\nJava import edges:`);
    for (const [src, targets] of javaEdges) {
      for (const t of targets) console.log(`  ${src} → ${t}`);
    }
  }
}

// Go module edges
const goEdges = Object.entries(graph.imports ?? {}).filter(([src]) => src.endsWith('.go'));
if (goEdges.length > 0) {
  console.log(`\nGo edges (sample, first 20):`);
  let shown = 0;
  for (const [src, targets] of goEdges) {
    for (const t of targets) {
      if (shown++ < 20) console.log(`  ${src} → ${t}`);
    }
  }
  const totalGo = goEdges.reduce((s, [, ts]) => s + ts.length, 0);
  console.log(`  … total Go edges: ${totalGo}`);
}

// Bazel edges
const bazelTargets = Object.values(graph.imports ?? {}).flat().filter(t =>
  Object.keys(graph.imports ?? {}).includes(t) &&
  Object.entries(graph.imports ?? {}).some(([src]) => src.includes('BUILD') || src.endsWith('.go'))
);

// Most-imported files
const top = Object.entries(depCounts).sort(([, a], [, b]) => b - a).slice(0, 8);
if (top.length > 0) {
  console.log(`\nMost-imported files (dependent count):`);
  for (const [path, count] of top) {
    console.log(`  ${count.toString().padStart(3)}  ${path}`);
  }
}

// Cross-package edges
const crossPkg = Object.entries(graph.imports ?? {}).flatMap(([src, targets]) =>
  targets.filter(t => {
    const srcDir = src.split('/').slice(0, -1).join('/');
    const tDir = t.split('/').slice(0, -1).join('/');
    return srcDir !== tDir;
  }).map(t => [src, t])
);
console.log(`\nCross-package edges: ${crossPkg.length} / ${totalEdges} total (${totalEdges > 0 ? Math.round(crossPkg.length / totalEdges * 100) : 0}%)`);

// Service module breakdown
const services = ['services/auth', 'services/pricing', 'services/matching', 'services/dispatch', 'shared', 'java-services'];
console.log('\nEdges by service:');
for (const svc of services) {
  const svcEdges = Object.entries(graph.imports ?? {})
    .filter(([src]) => src.startsWith(svc))
    .reduce((s, [, ts]) => s + ts.length, 0);
  const svcFiles = files.filter(f => f.path.startsWith(svc)).length;
  console.log(`  ${svc.padEnd(30)} ${svcEdges.toString().padStart(3)} edges  (${svcFiles} files)`);
}
