export interface InspectorHistoryEntry {
  assetId: string;
  timestamp: number;
}

export interface InspectorHistoryState {
  stack: InspectorHistoryEntry[];
  index: number; // points at current entry in stack
}

export function createHistory(): InspectorHistoryState {
  return { stack: [], index: -1 };
}

export function canBack(state: InspectorHistoryState): boolean {
  return state.index > 0;
}

export function canForward(state: InspectorHistoryState): boolean {
  return state.index >= 0 && state.index < state.stack.length - 1;
}

export function push(state: InspectorHistoryState, assetId: string): void {
  const last = state.stack[state.index];
  if (last && last.assetId === assetId) {
    // Replace current with updated timestamp
    state.stack[state.index] = { assetId, timestamp: Date.now() };
    return;
  }
  // Truncate forward history if we navigated back before
  if (state.index < state.stack.length - 1) {
    state.stack = state.stack.slice(0, state.index + 1);
  }
  state.stack.push({ assetId, timestamp: Date.now() });
  state.index = state.stack.length - 1;
}

export function replace(state: InspectorHistoryState, assetId: string): void {
  if (state.index < 0) {
    push(state, assetId);
    return;
  }
  state.stack[state.index] = { assetId, timestamp: Date.now() };
}

export async function back(
  state: InspectorHistoryState,
  existsResolver: (assetId: string) => Promise<boolean>
): Promise<string | null> {
  if (!canBack(state)) return null;
  const originalIndex = state.index;
  while (state.index > 0) {
    state.index--;
    const entry = state.stack[state.index];
    if (await existsResolver(entry.assetId)) {
      return entry.assetId;
    }
  }
  // restore if nothing valid
  state.index = originalIndex;
  return null;
}

export async function forward(
  state: InspectorHistoryState,
  existsResolver: (assetId: string) => Promise<boolean>
): Promise<string | null> {
  if (!canForward(state)) return null;
  const originalIndex = state.index;
  while (state.index < state.stack.length - 1) {
    state.index++;
    const entry = state.stack[state.index];
    if (await existsResolver(entry.assetId)) {
      return entry.assetId;
    }
  }
  state.index = originalIndex;
  return null;
}


