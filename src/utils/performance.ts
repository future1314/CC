/**
 * Performance optimization utilities
 */

export class PerformanceCache {
  private cache = new Map<string, any>();
  private maxSize = 100;

  get<T>(key: string, factory: () => T): T {
    if (this.cache.has(key)) {
      return this.cache.get(key) as T;
    }

    const value = factory();
    this.set(key, value);
    return value;
  }

  set(key: string, value: any): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const globalCache = new PerformanceCache();

export function memoizeAsync<T extends (...args: any[]) => Promise<any>>(fn: T): T {
  const cache = new Map<string, Promise<any>>();

  return async function(...args: any[]): Promise<any> {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const promise = fn(...args);
    cache.set(key, promise);

    try {
      const result = await promise;
      return result;
    } catch (error) {
      cache.delete(key);
      throw error;
    }
  } as T;
}

export function measurePerformance<T>(fn: () => T, label: string): T {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  console.log(`[PERF] ${label}: ${(end - start).toFixed(2)}ms`);
  return result;
}

export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timeoutId: NodeJS.Timeout;
  return ((...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}

export function throttleWithPromise<T extends (...args: any[]) => any>(fn: T, delay: number): T {
  let lastCall = 0;
  let pendingPromise: Promise<any> | null = null;

  return async function(...args: any[]): Promise<any> {
    const now = Date.now();
    if (now - lastCall < delay && pendingPromise) {
      return pendingPromise;
    }

    lastCall = now;
    pendingPromise = fn(...args);
    return pendingPromise;
  } as T;
}