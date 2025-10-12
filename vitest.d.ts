import 'vitest';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

// Augment Vitest's Assertion interface
declare module 'vitest' {
  interface Assertion<T = any> extends TestingLibraryMatchers<T, void> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<any, void> {}
}
