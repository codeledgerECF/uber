/**
 * Built-in language registry for CodeLedger.
 *
 * Provides language detection from file extensions, language family grouping,
 * and per-family resolution tables for imports and index files.
 *
 * Users never need to configure language support — this map ships with
 * CodeLedger and covers 30+ common extensions out of the box. Custom
 * extensions can be added via config.language_extensions overrides.
 */
/** Comprehensive built-in extension→language map. */
const KNOWN_EXTENSIONS = {
    // JavaScript / TypeScript
    '.ts': { language: 'typescript', family: 'javascript' },
    '.tsx': { language: 'typescript-react', family: 'javascript' },
    '.js': { language: 'javascript', family: 'javascript' },
    '.jsx': { language: 'javascript-react', family: 'javascript' },
    '.mjs': { language: 'javascript', family: 'javascript' },
    '.cjs': { language: 'javascript', family: 'javascript' },
    '.vue': { language: 'vue', family: 'javascript' },
    '.svelte': { language: 'svelte', family: 'javascript' },
    // Python
    '.py': { language: 'python', family: 'python' },
    '.pyi': { language: 'python-stub', family: 'python' },
    // Go
    '.go': { language: 'go', family: 'go' },
    // Rust
    '.rs': { language: 'rust', family: 'rust' },
    // Ruby
    '.rb': { language: 'ruby', family: 'ruby' },
    '.rake': { language: 'ruby', family: 'ruby' },
    // Java / Kotlin
    '.java': { language: 'java', family: 'java' },
    '.kt': { language: 'kotlin', family: 'kotlin' },
    '.kts': { language: 'kotlin', family: 'kotlin' },
    // C#
    '.cs': { language: 'csharp', family: 'csharp' },
    // C / C++
    '.c': { language: 'c', family: 'cpp' },
    '.h': { language: 'c-header', family: 'cpp' },
    '.cpp': { language: 'cpp', family: 'cpp' },
    '.hpp': { language: 'cpp-header', family: 'cpp' },
    '.cc': { language: 'cpp', family: 'cpp' },
    // Swift
    '.swift': { language: 'swift', family: 'swift' },
    // PHP
    '.php': { language: 'php', family: 'php' },
    // Shell
    '.sh': { language: 'shell', family: 'shell' },
    '.bash': { language: 'shell', family: 'shell' },
    '.zsh': { language: 'shell', family: 'shell' },
    // Markup / Config
    '.md': { language: 'markdown', family: 'markup' },
    '.html': { language: 'html', family: 'markup' },
    '.css': { language: 'css', family: 'markup' },
    '.scss': { language: 'scss', family: 'markup' },
    // Data / Config
    '.json': { language: 'json', family: 'data' },
    '.yaml': { language: 'yaml', family: 'data' },
    '.yml': { language: 'yaml', family: 'data' },
    '.toml': { language: 'toml', family: 'data' },
    '.xml': { language: 'xml', family: 'data' },
    '.sql': { language: 'sql', family: 'data' },
    '.proto': { language: 'protobuf', family: 'data' },
    '.graphql': { language: 'graphql', family: 'data' },
    '.gql': { language: 'graphql', family: 'data' },
    '.prisma': { language: 'prisma', family: 'data' },
};
/** Reverse map from language name to family (built lazily). */
const LANGUAGE_TO_FAMILY = new Map();
for (const entry of Object.values(KNOWN_EXTENSIONS)) {
    LANGUAGE_TO_FAMILY.set(entry.language, entry.family);
}
/**
 * Detect language and family from a file extension.
 * Config overrides take precedence over the built-in map.
 */
export function detectLanguage(ext, configOverrides) {
    const lower = ext.toLowerCase();
    // Config overrides first
    if (configOverrides?.[lower]) {
        const lang = configOverrides[lower];
        const family = LANGUAGE_TO_FAMILY.get(lang) ?? inferFamily(lang);
        return { language: lang, family };
    }
    // Built-in map
    return KNOWN_EXTENSIONS[lower] ?? { language: 'unknown', family: 'unknown' };
}
/** Map a language string to a family. */
export function languageFamily(language) {
    return LANGUAGE_TO_FAMILY.get(language) ?? inferFamily(language);
}
/** Map a file extension directly to a family (when language string is unavailable). */
export function extensionFamily(ext) {
    return KNOWN_EXTENSIONS[ext.toLowerCase()]?.family ?? 'unknown';
}
/** Extensions to try when resolving imports for a language family. */
export function resolutionExtensions(family) {
    switch (family) {
        case 'javascript': return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
        case 'python': return ['.py', '.pyi'];
        case 'go': return ['.go'];
        case 'ruby': return ['.rb'];
        case 'rust': return ['.rs'];
        case 'java': return ['.java'];
        case 'kotlin': return ['.kt', '.kts'];
        case 'csharp': return ['.cs'];
        case 'cpp': return ['.c', '.cpp', '.cc', '.h', '.hpp'];
        case 'swift': return ['.swift'];
        case 'php': return ['.php'];
        default: return [];
    }
}
/** Index file names for package/directory imports. */
export function indexFileNames(family) {
    switch (family) {
        case 'javascript': return ['index.ts', 'index.tsx', 'index.js', 'index.jsx', 'index.mjs', 'index.cjs'];
        case 'python': return ['__init__.py'];
        default: return [];
    }
}
/** Infer family from a language string using substring matching (for custom languages). */
function inferFamily(language) {
    const lower = language.toLowerCase();
    if (lower.includes('typescript') || lower.includes('javascript'))
        return 'javascript';
    if (lower.includes('python'))
        return 'python';
    if (lower.includes('go') || lower === 'golang')
        return 'go';
    if (lower.includes('ruby'))
        return 'ruby';
    if (lower.includes('rust'))
        return 'rust';
    if (lower.includes('java') && !lower.includes('javascript'))
        return 'java';
    if (lower.includes('kotlin'))
        return 'kotlin';
    if (lower.includes('csharp') || lower.includes('c#'))
        return 'csharp';
    if (lower.includes('swift'))
        return 'swift';
    if (lower.includes('php'))
        return 'php';
    return 'unknown';
}
//# sourceMappingURL=lang.js.map