/**
 * useNavigationPins — Manages pinned sidebar shortcuts via localStorage.
 */
import { useState, useCallback, useEffect } from 'react';

export interface PinnedItem {
  to: string;
  label: string;
  /** lucide icon name (mapped in sidebar) */
  iconKey?: string;
  pinnedAt: number;
}

const STORAGE_KEY = 'rh_gestao_nav_pins';
const MAX_PINS = 6;

function loadPins(): PinnedItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePins(pins: PinnedItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
}

export function useNavigationPins() {
  const [pins, setPins] = useState<PinnedItem[]>(loadPins);

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setPins(loadPins());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const addPin = useCallback((item: Omit<PinnedItem, 'pinnedAt'>) => {
    setPins(prev => {
      if (prev.some(p => p.to === item.to)) return prev;
      const next = [...prev, { ...item, pinnedAt: Date.now() }].slice(-MAX_PINS);
      savePins(next);
      return next;
    });
  }, []);

  const removePin = useCallback((to: string) => {
    setPins(prev => {
      const next = prev.filter(p => p.to !== to);
      savePins(next);
      return next;
    });
  }, []);

  const isPinned = useCallback((to: string) => pins.some(p => p.to === to), [pins]);

  const togglePin = useCallback((item: Omit<PinnedItem, 'pinnedAt'>) => {
    if (isPinned(item.to)) {
      removePin(item.to);
    } else {
      addPin(item);
    }
  }, [isPinned, addPin, removePin]);

  return { pins, addPin, removePin, isPinned, togglePin, maxPins: MAX_PINS };
}
