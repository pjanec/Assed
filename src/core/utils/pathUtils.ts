import { useAssetsStore, useCoreConfigStore, useWorkspaceStore } from '@/core/stores';
import { CreateFolderCommand, CompositeCommand } from '@/core/stores/workspace';

/**
 * Ensures that a given folder hierarchy exists under a parent, creating any missing
 * NamespaceFolder assets along the way.
 * @param targetParentFqn The FQN of the asset under which the path should be created (e.g., 'EnvB').
 * @param relativeFolderPath The intermediate path to create (e.g., 'WebServer::Configs').
 * @returns The FQN of the final folder in the path (e.g., 'EnvB::WebServer::Configs').
 */
export function ensurePathExists(targetParentFqn: string, relativeFolderPath: string | null): string {
  if (!relativeFolderPath) {
    return targetParentFqn; // No intermediate path to create
  }

  const assetsStore = useAssetsStore();
  const workspaceStore = useWorkspaceStore();
  const coreConfig = useCoreConfigStore();
    
  const pathSegments = relativeFolderPath.split('::');
  let currentParentFqn = targetParentFqn;
  const commandsToExecute: CreateFolderCommand[] = [];

  for (const segment of pathSegments) {
    const nextPathFqn = currentParentFqn ? `${currentParentFqn}::${segment}` : segment;
      
    // Check if the folder already exists in the live, unmerged asset list
    const existingAsset = assetsStore.unmergedAssets.find(a => a.fqn === nextPathFqn);

    if (!existingAsset) {
      // If it doesn't exist, create a command to make it.
      const command = new CreateFolderCommand(currentParentFqn, segment);
      commandsToExecute.push(command);
      // Manually add to a temporary map for subsequent checks within the same drop operation
      assetsStore.unmergedAssets.push(command.newFolder);
    }
      
    currentParentFqn = nextPathFqn;
  }

  // If we generated any commands, execute them as a single atomic transaction.
  if (commandsToExecute.length > 0) {
    workspaceStore.executeCommand(new CompositeCommand(commandsToExecute));
  }

  return currentParentFqn; // Return the FQN of the final folder
}
