import { useCoreConfigStore } from '@/core/stores/config';
import { ASSET_TYPES } from './config/constants';
import { LocalStorageAdapter } from './adapters/LocalStorageAdapter';
import { registerAllValidationRules } from './logic/validation';

export function registerAllContent() {
  const coreConfigStore = useCoreConfigStore();

  // 1. Configure Core basics
  coreConfigStore.setStructuralAssetType(ASSET_TYPES.NAMESPACE_FOLDER);

  // 2. Register the persistence adapter
  coreConfigStore.registerPersistenceAdapter(new LocalStorageAdapter());

  // 3. Register validation rules
  registerAllValidationRules();

  console.log("✅ Content modules successfully registered with the Core.");
}