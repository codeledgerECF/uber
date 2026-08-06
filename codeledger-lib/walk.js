import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
/** Directories that are always skipped regardless of config. */
const ALWAYS_SKIP = new Set([
    'node_modules', '.git', 'dist', 'build', '.codeledger',
    '.output', // Nitro/Vite/Nuxt output dir
    '.nuxt', // Nuxt build cache
    '.next', // Next.js build output
]);
export function walkFiles(root, includeGlobs, excludeGlobs) {
    // Parse root .gitignore and .codeledgerignore patterns, merge with config excludes.
    // .codeledgerignore works like .gitignore: users specify paths to exclude from indexing.
    const { excludes: gitExcludes, negations: gitNegations } = parseIgnoreFile(root, '.gitignore');
    const { excludes: clExcludes, negations: clNegations } = parseIgnoreFile(root, '.codeledgerignore');
    const allExcludes = [...excludeGlobs, ...gitExcludes, ...clExcludes];
    const allNegations = [...gitNegations, ...clNegations];
    const results = [];
    walk(root, root, includeGlobs, allExcludes, allNegations, results);
    return results;
}
/**
 * Parse an ignore file (.gitignore, .codeledgerignore) and return glob
 * patterns compatible with our exclude matching.
 *
 * Negation patterns (lines starting with !) are returned separately so
 * the walker can un-ignore files that match them.
 */
function parseIgnoreFile(root, filename) {
    const ignorePath = join(root, filename);
    if (!existsSync(ignorePath))
        return { excludes: [], negations: [] };
    try {
        const content = readFileSync(ignorePath, 'utf-8');
        const excludes = [];
        const negations = [];
        for (const rawLine of content.split('\n')) {
            const line = rawLine.trim();
            // Skip empty lines and comments
            if (!line || line.startsWith('#'))
                continue;
            // Detect negation patterns: strip the `!` and normalize like
            // any other pattern, but collect into the negations list.
            const isNegation = line.startsWith('!');
            const target = isNegation ? negations : excludes;
            let pat = isNegation ? line.slice(1) : line;
            // Skip bare negation operator with no pattern (e.g. a lone "!")
            if (!pat)
                continue;
            // Normalize patterns to match our full-relative-path glob matcher.
            // Git behavior: patterns without '/' match against the filename at any depth.
            if (pat.endsWith('/')) {
                // Explicit directory: "dirname/" -> "dirname/**"
                pat = pat.slice(0, -1) + '/**';
            }
            else if (!pat.includes('/')) {
                // No slash: git matches against filename at any depth.
                // Dotfile directory names like `.output` start with `.` but have no
                // second dot, so `!pat.includes('.')` is false — they would fall into
                // the "has extension" branch and generate `**/.output` (file match)
                // instead of the directory-contents patterns we need.
                const isDotfileDir = pat.startsWith('.') && !pat.slice(1).includes('.') && !pat.includes('*');
                if ((!pat.includes('.') && !pat.includes('*')) || isDotfileDir) {
                    // Bare name (e.g. Makefile, LICENSE, Dockerfile, .output, .nuxt):
                    // could be a file OR a directory at any depth.
                    target.push(pat); // root file match
                    target.push('**/' + pat); // file at any depth
                    target.push(pat + '/**'); // root dir contents
                    pat = '**/' + pat + '/**'; // dir contents at any depth
                }
                else {
                    // Has extension or glob (e.g. .env, *.log, .DS_Store)
                    target.push(pat); // root match
                    pat = '**/' + pat; // match at any depth
                }
            }
            // Patterns with a path separator are path-anchored, used as-is
            target.push(pat);
        }
        return { excludes, negations };
    }
    catch {
        return { excludes: [], negations: [] };
    }
}
function walk(base, dir, includeGlobs, excludeGlobs, negationGlobs, results) {
    let entries;
    try {
        // readdirSync's order is filesystem-dependent (APFS vs ext4 return
        // entries differently) — sort explicitly so the resulting file list,
        // and everything downstream that depends on it (manifest, bundle
        // ordering), is deterministic across platforms, not just within one.
        entries = readdirSync(dir).sort();
    }
    catch {
        return;
    }
    for (const entry of entries) {
        const fullPath = join(dir, entry);
        const rel = relative(base, fullPath);
        // Quick skip for always-excluded directories
        if (ALWAYS_SKIP.has(entry)) {
            continue;
        }
        let stat;
        try {
            stat = statSync(fullPath);
        }
        catch {
            continue;
        }
        if (stat.isDirectory()) {
            // Skip nested repositories -- a directory with its own .git is a
            // separate project and should never be indexed as part of this repo.
            if (existsSync(join(fullPath, '.git'))) {
                continue;
            }
            // Check if directory matches an exclude pattern (unless negated)
            const dirRel = rel + '/';
            const excluded = excludeGlobs.some((g) => matchSimple(dirRel, g))
                && !negationGlobs.some((g) => matchSimple(dirRel, g));
            if (!excluded) {
                walk(base, fullPath, includeGlobs, excludeGlobs, negationGlobs, results);
            }
        }
        else if (stat.isFile()) {
            const excluded = excludeGlobs.some((g) => matchSimple(rel, g))
                && !negationGlobs.some((g) => matchSimple(rel, g));
            if (excluded)
                continue;
            const included = includeGlobs.some((g) => matchSimple(rel, g));
            if (included) {
                results.push(fullPath);
            }
        }
    }
}
function matchSimple(path, pattern) {
    const regexStr = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '<<<GLOBSTAR>>>')
        .replace(/\*/g, '[^/]*')
        .replace(/<<<GLOBSTAR>>>/g, '.*')
        .replace(/\?/g, '.');
    return new RegExp(`^${regexStr}$`).test(path);
}
//# sourceMappingURL=walk.js.map