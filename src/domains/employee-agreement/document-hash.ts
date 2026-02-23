/**
 * Document Hash Utility
 *
 * Generates SHA-256 hashes for agreement documents using Web Crypto API.
 * Used for tamper detection and version integrity verification.
 */

/**
 * Generate SHA-256 hash of document content.
 * Works in browser and Deno edge runtime environments.
 */
export async function generateDocumentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify that document content matches an expected hash.
 */
export async function verifyDocumentHash(content: string, expectedHash: string): Promise<boolean> {
  const actualHash = await generateDocumentHash(content);
  return actualHash === expectedHash;
}
