// src/setupTests.ts

// This file adds the jest-dom matchers to Vitest's expect,
// allowing for expressive assertions on DOM nodes.
// e.g., expect(element).toBeInTheDocument()
// e.g., expect(element).toBeVisible()

import '@testing-library/jest-dom';
import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect interface with jest-dom matchers
expect.extend(matchers);







