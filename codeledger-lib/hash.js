import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
/**
 * Compute the SHA-256 hex digest of a file's contents.
 */
export function sha256File(filePath) {
    const content = readFileSync(filePath);
    return createHash('sha256').update(content).digest('hex');
}
//# sourceMappingURL=hash.js.map