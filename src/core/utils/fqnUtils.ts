/**
 * Calculates the relative path between a descendant FQN and one of its ancestor FQNs.
 * @param childFqn The FQN of the descendant asset (e.g., 'EnvA::WebServer::Nginx').
 * @param ancestorFqn The FQN of the ancestor asset (e.g., 'EnvA').
 * @returns The intermediate path string (e.g., 'WebServer::Nginx'), or an empty string if not a descendant.
 */
export function getIntermediatePath(childFqn: string, ancestorFqn: string | null): string {
  if (!ancestorFqn) {
    return childFqn;
  }
  if (childFqn.startsWith(ancestorFqn + '::')) {
    return childFqn.substring(ancestorFqn.length + 2);
  }
  return ''; // Not a direct descendant, or same FQN
}

/**
 * Extracts the parent path from a relative or full FQN.
 * @param path The FQN string (e.g., 'WebServer::Nginx').
 * @returns The parent path (e.g., 'WebServer'), or null if it's a top-level path.
 */
export function getParentPath(path: string): string | null {
  const lastIndex = path.lastIndexOf('::');
  if (lastIndex === -1) {
    return null; // No parent in this path
  }
  return path.substring(0, lastIndex);
}

/**
 * Extracts the final asset name (assetKey) from a relative or full FQN.
 * @param path The FQN string (e.g., 'WebServer::Nginx').
 * @returns The final name segment (e.g., 'Nginx').
 */
export function getAssetName(path: string): string {
  const lastIndex = path.lastIndexOf('::');
  if (lastIndex === -1) {
    return path;
  }
  return path.substring(lastIndex + 2);
}
