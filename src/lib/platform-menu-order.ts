/**
 * platform-menu-order — Shared persistence layer for platform sidebar ordering.
 *
 * Stores the ordered list of menu IDs (root + children) in localStorage.
 * PlatformLayout reads it to reorder NAV_ITEMS; PlatformMenuStructure writes it.
 */

const STORAGE_KEY = 'platform_menu_order';

export interface SavedMenuOrder {
  rootOrder: string[];               // ordered root item paths
  childrenOrder: Record<string, string[]>; // parentPath → ordered child paths
  savedAt: string;
}

export function getSavedMenuOrder(): SavedMenuOrder | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedMenuOrder;
  } catch {
    return null;
  }
}

/** Custom event dispatched whenever the menu order is saved.
 *  Allows same-tab listeners to react immediately (localStorage 'storage'
 *  event only fires in OTHER tabs, not the originating tab). */
export const MENU_ORDER_UPDATED_EVENT = 'platform:menu-order-updated';

export function saveMenuOrder(order: SavedMenuOrder): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  window.dispatchEvent(new CustomEvent(MENU_ORDER_UPDATED_EVENT));
}

/**
 * Reorder an array of items based on a saved order of keys.
 * Items not in savedOrder are appended at the end.
 */
export function applyOrder<T>(items: T[], savedOrder: string[], getKey: (item: T) => string): T[] {
  const map = new Map(items.map(i => [getKey(i), i]));
  const result: T[] = [];

  // First, add items in saved order
  for (const key of savedOrder) {
    const item = map.get(key);
    if (item) {
      result.push(item);
      map.delete(key);
    }
  }

  // Append any remaining items not in saved order
  for (const item of map.values()) {
    result.push(item);
  }

  return result;
}
