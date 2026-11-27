'use client';
import { useSyncExternalStore } from 'react';
const subscribe = () => () => {
  /* Hydration has no external subscription to release. */
};
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
