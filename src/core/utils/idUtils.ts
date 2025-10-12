// src/utils/idUtils.js

/**
 * Generates a simple Version 4 UUID.
 * @returns {string} A new unique identifier.
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}







