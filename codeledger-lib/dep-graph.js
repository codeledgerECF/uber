import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { languageFamily, resolutionExtensions, indexFileNames } from './lang.js';
// ── JS/TS import regexes ────────────────────────────────────────────────────
const JS_IMPORT_RE = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
const JS_REQUIRE_RE = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
// ── Python import regexes ───────────────────────────────────────────────────
/** from foo.bar import baz  / from . import foo */
const PY_FROM_IMPORT_RE = /^from\s+([\w.]+|\.+[\w.]*)\s+import\s+([^\n#]+)/gm;
/** import foo.bar, foo.baz as baz */
const PY_IMPORT_RE = /^import\s+([^\n#]+)/gm;
// ── Go import regexes ───────────────────────────────────────────────────────
/** Single-line: import "path/to/pkg" or import alias "path/to/pkg" */
const GO_SINGLE_IMPORT_RE = /import\s+(?:\w+\s+)?"([^"]+)"/g;
/** Multi-line: import ( ... ) */
const GO_IMPORT_BLOCK_RE = /import\s*\(([\s\S]*?)\)/g;
/** Lines within a multi-line block */
const GO_IMPORT_LINE_RE = /(?:\w+\s+)?"([^"]+)"/g;
// ── Bazel BUILD file regexes ────────────────────────────────────────────────
/** Matches quoted workspace-local dep references: "//path/to/dir" or "//path/to/dir:target" */
const BAZEL_LOCAL_DEP_RE = /"(\/\/[^"@*\s][^"]*)"/g;
// ─────────────────────────────────────────────────────────────────────────────
export function buildDepGraph(root, files, contentCache) {
    const imports = {};
    const dependents = {};
    const fileSet = new Set(files.map((f) => f.path));
    // Go: discover all go.mod files (handles monorepos with multiple modules)
    const goModules = discoverGoModules(root, files);
    // Go: pre-build dir → files map for efficient package-level resolution
    const goFilesByDir = new Map();
    for (const file of files) {
        if (file.language !== 'go')
            continue;
        const dir = dirname(file.path);
        const d = dir === '.' ? '' : dir.replace(/\\/g, '/');
        const list = goFilesByDir.get(d) ?? [];
        list.push(file.path);
        goFilesByDir.set(d, list);
    }
    // Java/Kotlin: discover source roots, package→files map, and DI implementors
    const { javaSourceRoots, javaFilesByPkgDir, interfaceImplementors } = discoverJavaSourceRoots(root, files, contentCache);
    // Bazel: extract BUILD-declared dep edges before the import loop
    const bazelDeps = discoverBazelDeps(root, files);
    for (const file of files) {
        let content;
        const cached = contentCache?.get(file.path);
        if (cached !== undefined) {
            content = cached;
        }
        else {
            const absPath = join(root, file.path);
            try {
                content = readFileSync(absPath, 'utf-8');
            }
            catch {
                continue;
            }
        }
        const family = languageFamily(file.language);
        const resolved = extractImports(content, file.path, family, root, fileSet, goModules, goFilesByDir, javaSourceRoots, javaFilesByPkgDir, interfaceImplementors);
        imports[file.path] = resolved;
        for (const dep of resolved) {
            if (!dependents[dep])
                dependents[dep] = [];
            dependents[dep].push(file.path);
        }
    }
    // Merge Bazel BUILD-declared edges (directory-level dep declarations)
    for (const [srcFile, bazelDepFiles] of bazelDeps) {
        const existing = new Set(imports[srcFile] ?? []);
        const added = [];
        for (const dep of bazelDepFiles) {
            if (!existing.has(dep)) {
                existing.add(dep);
                added.push(dep);
            }
        }
        if (added.length > 0) {
            imports[srcFile] = [...(imports[srcFile] ?? []), ...added];
            for (const dep of added) {
                if (!dependents[dep])
                    dependents[dep] = [];
                dependents[dep].push(srcFile);
            }
        }
    }
    return { imports, dependents };
}
// ── Dispatch ────────────────────────────────────────────────────────────────
function extractImports(content, filePath, family, root, fileSet, goModules, goFilesByDir, javaSourceRoots, javaFilesByPkgDir, interfaceImplementors) {
    switch (family) {
        case 'python':
            return extractPythonImports(content, filePath, fileSet);
        case 'go':
            return extractGoImports(content, filePath, fileSet, goModules, goFilesByDir);
        case 'rust':
            return extractRustImports(content, filePath, fileSet);
        case 'ruby':
            return extractRubyImports(content, filePath, fileSet);
        case 'java':
        case 'kotlin':
            return extractJavaImports(content, fileSet, javaSourceRoots, javaFilesByPkgDir, interfaceImplementors);
        case 'cpp':
            return extractCIncludes(content, filePath, fileSet);
        default:
            return extractJsImports(content, filePath, root, fileSet);
    }
}
// ── JS/TS imports ───────────────────────────────────────────────────────────
function extractJsImports(content, filePath, root, fileSet) {
    const specifiers = new Set();
    for (const regex of [JS_IMPORT_RE, JS_REQUIRE_RE]) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(content)) !== null) {
            const spec = match[1];
            if (spec && isRelativeJs(spec)) {
                specifiers.add(spec);
            }
        }
    }
    const resolved = [];
    const dir = dirname(filePath);
    for (const spec of specifiers) {
        const target = resolveJsImport(dir, spec, root, fileSet);
        if (target) {
            resolved.push(target);
        }
    }
    return resolved;
}
function isRelativeJs(spec) {
    return spec.startsWith('./') || spec.startsWith('../');
}
function resolveJsImport(fromDir, spec, _root, fileSet) {
    const base = join(fromDir, spec).replace(/\\/g, '/');
    if (fileSet.has(base))
        return base;
    const extensions = resolutionExtensions('javascript');
    // Strip .js extension if present (ESM convention)
    const withoutJs = base.endsWith('.js') ? base.slice(0, -3) : null;
    if (withoutJs) {
        for (const ext of extensions) {
            const candidate = withoutJs + ext;
            if (fileSet.has(candidate))
                return candidate;
        }
    }
    // Try adding extensions
    for (const ext of extensions) {
        const candidate = base + ext;
        if (fileSet.has(candidate))
            return candidate;
    }
    // Try index files
    for (const name of indexFileNames('javascript')) {
        const candidate = base + '/' + name;
        if (fileSet.has(candidate))
            return candidate;
    }
    return null;
}
// ── Python imports ──────────────────────────────────────────────────────────
function extractPythonImports(content, filePath, fileSet) {
    const dir = dirname(filePath);
    const resolved = [];
    // from . import foo, from ..utils import bar, from src.pkg import module
    PY_FROM_IMPORT_RE.lastIndex = 0;
    let match;
    while ((match = PY_FROM_IMPORT_RE.exec(content)) !== null) {
        const modulePath = match[1];
        const importedNames = parsePythonImportNames(match[2]);
        const targets = modulePath.startsWith('.')
            ? resolvePythonFromImport(dir, modulePath, importedNames, fileSet)
            : resolvePythonFromImport(null, modulePath, importedNames, fileSet);
        resolved.push(...targets);
    }
    // import foo.bar, foo.baz as baz
    PY_IMPORT_RE.lastIndex = 0;
    while ((match = PY_IMPORT_RE.exec(content)) !== null) {
        for (const modulePath of parsePythonImportNames(match[1])) {
            const target = resolvePythonModule(modulePath, fileSet);
            if (target) {
                resolved.push(target);
            }
        }
    }
    return [...new Set(resolved)];
}
function resolvePythonFromImport(fromDir, modulePath, importedNames, fileSet) {
    const baseModule = fromDir && modulePath.startsWith('.')
        ? resolvePythonRelativeModuleBase(fromDir, modulePath)
        : modulePath;
    const resolved = new Set();
    for (const importedName of importedNames) {
        if (importedName === '*')
            continue;
        const childModule = baseModule ? `${baseModule}.${importedName}` : importedName;
        const childTarget = resolvePythonModule(childModule, fileSet);
        if (childTarget) {
            resolved.add(childTarget);
        }
    }
    const baseTarget = resolvePythonModule(baseModule, fileSet);
    if (baseTarget) {
        resolved.add(baseTarget);
    }
    return [...resolved];
}
function resolvePythonRelativeModuleBase(fromDir, spec) {
    // Count leading dots
    let dots = 0;
    while (dots < spec.length && spec[dots] === '.')
        dots++;
    const modulePart = spec.slice(dots);
    // Navigate up (dots - 1) directories (one dot = current package)
    let baseDir = fromDir;
    for (let i = 1; i < dots; i++) {
        baseDir = dirname(baseDir);
    }
    const relPath = modulePart ? modulePart.replace(/\./g, '/') : '';
    return relPath ? join(baseDir, relPath).replace(/\\/g, '/') : baseDir;
}
function resolvePythonModule(modulePath, fileSet) {
    const relPath = modulePath.replace(/\./g, '/');
    for (const prefix of ['', 'src/', 'lib/']) {
        const base = prefix + relPath;
        for (const ext of resolutionExtensions('python')) {
            if (fileSet.has(base + ext))
                return base + ext;
        }
        for (const name of indexFileNames('python')) {
            if (fileSet.has(base + '/' + name))
                return base + '/' + name;
        }
    }
    return null;
}
function parsePythonImportNames(importList) {
    return importList
        .split(',')
        .map((part) => part.trim().replace(/\s+as\s+\w+$/u, ''))
        .filter((part) => part.length > 0 && /^(?:[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*|\*)$/u.test(part));
}
// ── Rust imports ─────────────────────────────────────────────────────────────
/** mod foo; — submodule declaration implies foo.rs or foo/mod.rs */
const RUST_MOD_DECL_RE = /^\s*(?:pub(?:\([^)]*\))?\s+)?mod\s+(\w+)\s*;/gm;
/**
 * use self::foo, use super::foo, use crate::path::to::module — resolve to local
 * source files when the path segment maps to an existing .rs file.
 * Only the first path segment after the anchor is resolved (single-hop).
 * Anchor is captured separately so crate:: resolves from the src root while
 * super:: and self:: resolve from the current directory.
 */
const RUST_USE_LOCAL_RE = /^\s*use\s+(self|super|crate)::([A-Za-z_][A-Za-z0-9_:]*)(?:\s*;|::|\s*\{)/gm;
function extractRustImports(content, filePath, fileSet) {
    const dir = dirname(filePath);
    // Derive the crate src root from the file path — works for both relative paths
    // ('src/handlers/auth.rs') and absolute ones ('/repo/src/handlers/auth.rs').
    const srcRoot = (() => {
        const slashIdx = filePath.lastIndexOf('/src/');
        if (slashIdx >= 0)
            return filePath.slice(0, slashIdx + 5); // absolute: .../src/
        if (filePath.startsWith('src/') || filePath.startsWith('src\\'))
            return 'src';
        return dir;
    })();
    const resolved = [];
    // mod foo; — submodule file declarations
    RUST_MOD_DECL_RE.lastIndex = 0;
    let match;
    while ((match = RUST_MOD_DECL_RE.exec(content)) !== null) {
        const modName = match[1];
        const direct = join(dir, modName + '.rs').replace(/\\/g, '/');
        const subdir = join(dir, modName, 'mod.rs').replace(/\\/g, '/');
        if (fileSet.has(direct))
            resolved.push(direct);
        else if (fileSet.has(subdir))
            resolved.push(subdir);
    }
    // use crate:: → resolve from src root; use super::/self:: → resolve from current dir
    RUST_USE_LOCAL_RE.lastIndex = 0;
    while ((match = RUST_USE_LOCAL_RE.exec(content)) !== null) {
        const anchor = match[1]; // 'self' | 'super' | 'crate'
        const firstSeg = match[2].split('::')[0];
        const base = anchor === 'crate' ? srcRoot : dir;
        const direct = join(base, firstSeg + '.rs').replace(/\\/g, '/');
        const subdir = join(base, firstSeg, 'mod.rs').replace(/\\/g, '/');
        if (fileSet.has(direct))
            resolved.push(direct);
        else if (fileSet.has(subdir))
            resolved.push(subdir);
    }
    return [...new Set(resolved)];
}
// ── Ruby imports ─────────────────────────────────────────────────────────────
const RUBY_REQUIRE_REL_RE = /require_relative\s+['"]([^'"]+)['"]/g;
const RUBY_REQUIRE_RE = /^\s*require\s+['"]([^'"]+)['"]/gm;
function extractRubyImports(content, filePath, fileSet) {
    const dir = dirname(filePath);
    const resolved = [];
    RUBY_REQUIRE_REL_RE.lastIndex = 0;
    let match;
    while ((match = RUBY_REQUIRE_REL_RE.exec(content)) !== null) {
        const spec = match[1];
        const base = join(dir, spec).replace(/\\/g, '/');
        for (const ext of resolutionExtensions('ruby')) {
            const candidate = base.endsWith(ext) ? base : base + ext;
            if (fileSet.has(candidate)) {
                resolved.push(candidate);
                break;
            }
        }
    }
    // Non-relative require: try common local roots for paths with slashes
    RUBY_REQUIRE_RE.lastIndex = 0;
    while ((match = RUBY_REQUIRE_RE.exec(content)) !== null) {
        const name = match[1];
        if (!name.includes('/'))
            continue; // single-word names are gems/stdlib
        for (const prefix of ['', 'lib/', 'app/']) {
            const base = prefix + name;
            for (const ext of resolutionExtensions('ruby')) {
                const candidate = base.endsWith(ext) ? base : base + ext;
                if (fileSet.has(candidate)) {
                    resolved.push(candidate);
                    break;
                }
            }
        }
    }
    return [...new Set(resolved)];
}
// ── Java / Kotlin imports ─────────────────────────────────────────────────────
// Matches Java and Kotlin imports (Kotlin omits the trailing semicolon).
// Supports wildcard imports: import com.example.service.*
// Pattern: identifier(.identifier)* optionally followed by .*
const JAVA_IMPORT_RE = /^\s*import\s+(?:static\s+)?([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*(?:\.\*)?)\s*;?/gm;
// Kotlin packages use no semicolons; Java packages do. Accept both.
const JAVA_PACKAGE_RE = /^\s*package\s+([\w.]+)\s*;?/m;
// Java: class Foo implements Bar, Baz<T>
const JAVA_IMPLEMENTS_RE = /\bimplements\s+([^{;]+)/g;
// Kotlin supertype list after ':'. Stops at '{', a 'where' clause, or end of line.
// We only want interface names (PascalCase, not constructor calls like Base())
const KOTLIN_SUPERTYPES_RE = /\bclass\s+\w+(?:<[^>]*>)?(?:\([^)]*\))?\s*:\s*(.+?)(?:\s+where\b|\s*\{|$)/gm;
/** Standard Maven/Gradle source root fallbacks when package-based discovery misses. */
const JAVA_FALLBACK_ROOTS = ['src/main/java/', 'src/test/java/', 'src/', ''];
/**
 * Pre-pass over all Java/Kotlin files to discover source roots and build a
 * package-directory → file-list map for wildcard import resolution.
 *
 * Source root derivation (no pom.xml/build.gradle needed):
 *   File at  "module-a/src/main/java/com/example/service/UserService.java"
 *   Package  "com.example.service"
 *   Strip    "com/example/service/UserService.java" from end of dir
 *   Root  →  "module-a/src/main/java/"
 *
 * This handles any multi-module layout automatically.
 */
function discoverJavaSourceRoots(root, files, contentCache) {
    const sourceRootSet = new Set(JAVA_FALLBACK_ROOTS);
    const javaFilesByPkgDir = new Map();
    // Collects: simple interface name → list of file paths that implement it.
    // Used in extractJavaImports to add DI implementation edges automatically.
    const interfaceImplementors = new Map();
    for (const file of files) {
        if (file.language !== 'java' && file.language !== 'kotlin')
            continue;
        let content;
        const cached = contentCache?.get(file.path);
        if (cached !== undefined) {
            content = cached;
        }
        else {
            try {
                content = readFileSync(join(root, file.path), 'utf-8');
            }
            catch {
                continue;
            }
        }
        const pkgMatch = content.match(JAVA_PACKAGE_RE);
        if (pkgMatch) {
            const pkg = pkgMatch[1];
            const pkgDir = pkg.replace(/\./g, '/') + '/';
            // Derive source root: strip "<pkgDir><ClassName>.java" from the file's dir
            const fileDir = file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/') + 1) : '';
            const idx = fileDir.indexOf(pkgDir);
            if (idx !== -1) {
                sourceRootSet.add(fileDir.slice(0, idx));
            }
            // Index for wildcard resolution: "com/example/service/" → [list of .java/.kt files]
            const list = javaFilesByPkgDir.get(pkgDir) ?? [];
            list.push(file.path);
            javaFilesByPkgDir.set(pkgDir, list);
        }
        // Scan for interface implementations to build DI edge map.
        // Java: class Foo implements Bar, Baz<T>
        // Kotlin: class Foo : Bar, Baz (supertype list after ':')
        const ifaceNames = [];
        if (file.language === 'java') {
            JAVA_IMPLEMENTS_RE.lastIndex = 0;
            let m;
            while ((m = JAVA_IMPLEMENTS_RE.exec(content)) !== null) {
                for (const raw of m[1].split(',')) {
                    // Strip generic params: "Map<String,Integer>" → "Map"
                    const name = raw.trim().replace(/<[^>]*>/g, '').trim();
                    if (name)
                        ifaceNames.push(name);
                }
            }
        }
        else {
            // Kotlin supertype list: class Foo : IBar, AbstractBase()
            // Only include PascalCase names without () — those are interfaces or abstract classes,
            // not constructor calls to concrete superclasses.
            KOTLIN_SUPERTYPES_RE.lastIndex = 0;
            let m;
            while ((m = KOTLIN_SUPERTYPES_RE.exec(content)) !== null) {
                for (const raw of m[1].split(',')) {
                    const name = raw.trim().replace(/<[^>]*>/g, '').trim();
                    // Skip constructor calls (e.g. "Base(args)") — only plain type names
                    if (name && /^[A-Z]\w*$/.test(name))
                        ifaceNames.push(name);
                }
            }
        }
        for (const iface of ifaceNames) {
            const impls = interfaceImplementors.get(iface) ?? [];
            impls.push(file.path);
            interfaceImplementors.set(iface, impls);
        }
    }
    return { javaSourceRoots: [...sourceRootSet], javaFilesByPkgDir, interfaceImplementors };
}
function extractJavaImports(content, fileSet, sourceRoots, filesByPkgDir, ifaceImpls) {
    const resolved = [];
    JAVA_IMPORT_RE.lastIndex = 0;
    let match;
    while ((match = JAVA_IMPORT_RE.exec(content)) !== null) {
        const fqn = match[1];
        // Wildcard: import com.example.service.* — resolve to all files in that package
        if (fqn.endsWith('.*')) {
            const pkgDir = fqn.slice(0, -2).replace(/\./g, '/') + '/';
            const pkgFiles = filesByPkgDir.get(pkgDir);
            if (pkgFiles)
                resolved.push(...pkgFiles);
            continue;
        }
        const relPath = fqn.replace(/\./g, '/');
        let found = false;
        // Exact resolution: try every discovered source root × [.java, .kt, .kts]
        outer: for (const ext of ['.java', '.kt', '.kts']) {
            for (const prefix of sourceRoots) {
                const candidate = prefix + relPath + ext;
                if (fileSet.has(candidate)) {
                    resolved.push(candidate);
                    found = true;
                    // DI edge: if this imported class has known implementations in the repo,
                    // add them as implicit dependencies. Handles Spring @Autowired, .NET DI, etc.
                    const simpleName = candidate.replace(/\.(java|kt|kts)$/, '').split('/').pop() ?? '';
                    const impls = ifaceImpls.get(simpleName);
                    if (impls) {
                        for (const impl of impls) {
                            if (fileSet.has(impl) && impl !== candidate)
                                resolved.push(impl);
                        }
                    }
                    break outer;
                }
            }
        }
        // Inner-class fallback: com.example.Foo.Bar → try com.example.Foo
        // (the last segment may be a nested class, not a separate file)
        if (!found) {
            const lastSlash = relPath.lastIndexOf('/');
            if (lastSlash > 0) {
                const outerPath = relPath.slice(0, lastSlash);
                for (const ext of ['.java', '.kt', '.kts']) {
                    for (const prefix of sourceRoots) {
                        const candidate = prefix + outerPath + ext;
                        if (fileSet.has(candidate)) {
                            resolved.push(candidate);
                            break;
                        }
                    }
                }
            }
        }
    }
    return [...new Set(resolved)];
}
// ── C / C++ includes ──────────────────────────────────────────────────────────
/** #include "local/header.h" — angle-bracket includes are external and skipped */
const C_LOCAL_INCLUDE_RE = /^\s*#\s*include\s+"([^"]+)"/gm;
function extractCIncludes(content, filePath, fileSet) {
    const dir = dirname(filePath);
    const resolved = [];
    C_LOCAL_INCLUDE_RE.lastIndex = 0;
    let match;
    while ((match = C_LOCAL_INCLUDE_RE.exec(content)) !== null) {
        const spec = match[1];
        for (const base of [join(dir, spec).replace(/\\/g, '/'), spec]) {
            if (fileSet.has(base)) {
                resolved.push(base);
                break;
            }
        }
    }
    return [...new Set(resolved)];
}
// ── Go imports (multi-module) ─────────────────────────────────────────────────
/**
 * Discover all go.mod files in the repo by walking up from each Go file's
 * directory. Caches reads to avoid redundant I/O. Handles monorepos where
 * each service has its own go.mod (e.g. services/auth/go.mod,
 * services/pricing/go.mod).
 */
function discoverGoModules(root, files) {
    const goModCache = new Map(); // dir → module path or null
    const modules = new Map(); // moduleRoot → modulePath
    const tryReadGoMod = (dir) => {
        if (goModCache.has(dir))
            return goModCache.get(dir) ?? null;
        try {
            const absPath = dir ? join(root, dir, 'go.mod') : join(root, 'go.mod');
            const content = readFileSync(absPath, 'utf-8');
            const m = content.match(/^module\s+(\S+)/m);
            const result = m ? m[1] : null;
            goModCache.set(dir, result);
            return result;
        }
        catch {
            goModCache.set(dir, null);
            return null;
        }
    };
    for (const file of files) {
        if (file.language !== 'go')
            continue;
        let dir = dirname(file.path);
        if (dir === '.')
            dir = '';
        // Walk up from the file's directory looking for go.mod
        let current = dir;
        while (true) {
            const modulePath = tryReadGoMod(current);
            if (modulePath) {
                modules.set(current, modulePath);
                break;
            }
            if (!current)
                break;
            const parent = dirname(current);
            current = parent === '.' ? '' : parent.replace(/\\/g, '/');
        }
    }
    return [...modules.entries()].map(([moduleRoot, modulePath]) => ({ modulePath, moduleRoot }));
}
function extractGoImports(content, filePath, fileSet, goModules, goFilesByDir) {
    const importPaths = new Set();
    // Single-line imports: import "pkg" or import alias "pkg"
    GO_SINGLE_IMPORT_RE.lastIndex = 0;
    let match;
    while ((match = GO_SINGLE_IMPORT_RE.exec(content)) !== null) {
        importPaths.add(match[1]);
    }
    // Multi-line import blocks: import ( ... )
    GO_IMPORT_BLOCK_RE.lastIndex = 0;
    while ((match = GO_IMPORT_BLOCK_RE.exec(content)) !== null) {
        const block = match[1];
        GO_IMPORT_LINE_RE.lastIndex = 0;
        let lineMatch;
        while ((lineMatch = GO_IMPORT_LINE_RE.exec(block)) !== null) {
            importPaths.add(lineMatch[1]);
        }
    }
    const resolved = [];
    const fileDir = dirname(filePath);
    const normalizedFileDir = fileDir === '.' ? '' : fileDir.replace(/\\/g, '/');
    for (const importPath of importPaths) {
        // Relative imports: ./subpkg or ../sibling
        if (importPath.startsWith('./') || importPath.startsWith('../')) {
            const base = join(normalizedFileDir, importPath).replace(/\\/g, '/');
            resolved.push(...findGoFilesInDir(base, goFilesByDir, fileSet));
            continue;
        }
        // Module-local imports: match against all discovered go.mod files.
        // A monorepo may have services/auth (module github.com/co/auth) and
        // services/pricing (module github.com/co/pricing) — try each.
        let matched = false;
        for (const { modulePath, moduleRoot } of goModules) {
            if (importPath === modulePath || importPath.startsWith(modulePath + '/')) {
                const relPkg = importPath.slice(modulePath.length).replace(/^\//, '');
                const pkgDir = moduleRoot
                    ? (relPkg ? moduleRoot + '/' + relPkg : moduleRoot)
                    : relPkg;
                const hits = findGoFilesInDir(pkgDir, goFilesByDir, fileSet);
                resolved.push(...hits);
                if (hits.length > 0) {
                    matched = true;
                    break;
                }
            }
        }
        // External (third-party) imports not matched by any module are skipped.
        void matched;
    }
    return [...new Set(resolved)];
}
/**
 * Return all non-test .go files in a package directory.
 * Go packages are directory-scoped: importing a package imports all its files.
 * Uses the pre-built goFilesByDir map for O(1) lookup.
 */
function findGoFilesInDir(dirPath, goFilesByDir, fileSet) {
    const normalized = dirPath.replace(/\\/g, '/');
    const dirFiles = goFilesByDir.get(normalized);
    if (dirFiles)
        return dirFiles.filter((f) => !f.endsWith('_test.go'));
    // Fallback: direct .go file with same base name
    const direct = normalized + '.go';
    if (fileSet.has(direct))
        return [direct];
    return [];
}
// ── Bazel BUILD file deps ─────────────────────────────────────────────────────
/**
 * Parse BUILD and BUILD.bazel files in directories that contain indexed source
 * files. Extracts workspace-local dep references (//path/to/dir:target) and
 * returns a map of source file → dep source files.
 *
 * Bazel's BUILD files are the authoritative dependency declaration for many
 * enterprise monorepos (Uber, Google, Meta). They cover cases import analysis
 * misses: generated proto bindings, code-gen output, resource files.
 *
 * External deps (@maven//:guava, @npm//lodash) are ignored — only //... refs
 * map to local source files.
 */
function discoverBazelDeps(root, files) {
    // Pre-build dir → files index
    const filesByDir = new Map();
    for (const f of files) {
        const dir = dirname(f.path);
        const d = dir === '.' ? '' : dir.replace(/\\/g, '/');
        const list = filesByDir.get(d) ?? [];
        list.push(f.path);
        filesByDir.set(d, list);
    }
    // Cache BUILD file reads; null = no BUILD file in this dir
    const buildCache = new Map();
    const tryReadBuild = (dir) => {
        if (buildCache.has(dir))
            return buildCache.get(dir) ?? null;
        for (const name of ['BUILD.bazel', 'BUILD']) {
            try {
                const absPath = dir ? join(root, dir, name) : join(root, name);
                const content = readFileSync(absPath, 'utf-8');
                buildCache.set(dir, content);
                return content;
            }
            catch { /* try next */ }
        }
        buildCache.set(dir, null);
        return null;
    };
    const result = new Map();
    for (const [dir, dirFiles] of filesByDir) {
        const buildContent = tryReadBuild(dir);
        if (!buildContent)
            continue;
        // Collect dep dirs from //path/to/dir:target references
        const depDirs = new Set();
        BAZEL_LOCAL_DEP_RE.lastIndex = 0;
        let match;
        while ((match = BAZEL_LOCAL_DEP_RE.exec(buildContent)) !== null) {
            const ref = match[1];
            if (!ref.startsWith('//'))
                continue;
            const noPrefix = ref.slice(2);
            // Strip :target suffix; keep just the directory path
            const colonIdx = noPrefix.indexOf(':');
            const depDir = (colonIdx >= 0 ? noPrefix.slice(0, colonIdx) : noPrefix)
                .replace(/\\/g, '/');
            if (depDir)
                depDirs.add(depDir);
        }
        if (depDirs.size === 0)
            continue;
        // Collect all source files from dep dirs
        const depFiles = [];
        for (const depDir of depDirs) {
            const df = filesByDir.get(depDir);
            if (df)
                depFiles.push(...df);
        }
        if (depFiles.length === 0)
            continue;
        // Every file in this BUILD dir inherits its declared deps
        for (const srcFile of dirFiles) {
            result.set(srcFile, depFiles);
        }
    }
    return result;
}
//# sourceMappingURL=dep-graph.js.map