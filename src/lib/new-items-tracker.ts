/**
 * NewItemsTracker — Tracks newly discovered items and marks them as "NOVO" for 3 days.
 * Persists to localStorage per category (menus, events, modules).
 */

const STORAGE_PREFIX = 'platform_new_items_';
const NEW_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

interface TrackedItem {
  id: string;
  discoveredAt: number; // timestamp ms
}

interface TrackerState {
  knownIds: string[];
  newItems: TrackedItem[];
  lastScanAt: number | null;
}

function getState(category: string): TrackerState {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${category}`);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { knownIds: [], newItems: [], lastScanAt: null };
}

function setState(category: string, state: TrackerState) {
  localStorage.setItem(`${STORAGE_PREFIX}${category}`, JSON.stringify(state));
}

/**
 * Scan a list of current item IDs against known IDs.
 * Returns newly discovered IDs and updates storage.
 */
export function scanForNewItems(category: string, currentIds: string[]): string[] {
  const state = getState(category);
  const now = Date.now();

  // Clean expired "new" items (older than 3 days)
  const activeNewItems = state.newItems.filter(
    item => now - item.discoveredAt < NEW_DURATION_MS
  );

  // If first scan ever, mark all as known (no "NOVO" on first load)
  if (state.knownIds.length === 0 && state.lastScanAt === null) {
    setState(category, {
      knownIds: currentIds,
      newItems: [],
      lastScanAt: now,
    });
    return [];
  }

  // Find truly new items (not in known list)
  const knownSet = new Set(state.knownIds);
  const newlyDiscovered = currentIds.filter(id => !knownSet.has(id));

  // Add newly discovered to newItems list
  const newTracked: TrackedItem[] = [
    ...activeNewItems,
    ...newlyDiscovered
      .filter(id => !activeNewItems.some(ni => ni.id === id))
      .map(id => ({ id, discoveredAt: now })),
  ];

  // Update known IDs to include everything
  const allKnown = Array.from(new Set([...state.knownIds, ...currentIds]));

  setState(category, {
    knownIds: allKnown,
    newItems: newTracked,
    lastScanAt: now,
  });

  return newlyDiscovered;
}

/**
 * Check if a specific item ID is marked as "NOVO" (within 3-day window).
 */
export function isNewItem(category: string, itemId: string): boolean {
  const state = getState(category);
  const now = Date.now();
  return state.newItems.some(
    item => item.id === itemId && now - item.discoveredAt < NEW_DURATION_MS
  );
}

/**
 * Get all currently "new" item IDs for a category.
 */
export function getNewItemIds(category: string): Set<string> {
  const state = getState(category);
  const now = Date.now();
  const ids = state.newItems
    .filter(item => now - item.discoveredAt < NEW_DURATION_MS)
    .map(item => item.id);
  return new Set(ids);
}

/**
 * Get the last scan timestamp for a category.
 */
export function getLastScanTime(category: string): number | null {
  return getState(category).lastScanAt;
}
