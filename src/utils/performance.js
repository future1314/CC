/**
 * Performance optimization utilities
 */
export class PerformanceCache {
    cache = new Map();
    maxSize = 100;
    get(key, factory) {
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        const value = factory();
        this.set(key, value);
        return value;
    }
    set(key, value) {
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }
    clear() {
        this.cache.clear();
    }
}
export const globalCache = new PerformanceCache();
export function memoizeAsync(fn) {
    const cache = new Map();
    return async function (...args) {
        const key = JSON.stringify(args);
        if (cache.has(key)) {
            return cache.get(key);
        }
        const promise = fn(...args);
        cache.set(key, promise);
        try {
            const result = await promise;
            return result;
        }
        catch (error) {
            cache.delete(key);
            throw error;
        }
    };
}
export function measurePerformance(fn, label) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    console.log(`[PERF] ${label}: ${(end - start).toFixed(2)}ms`);
    return result;
}
export function debounce(fn, delay) {
    let timeoutId;
    return ((...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    });
}
export function throttleWithPromise(fn, delay) {
    let lastCall = 0;
    let pendingPromise = null;
    return async function (...args) {
        const now = Date.now();
        if (now - lastCall < delay && pendingPromise) {
            return pendingPromise;
        }
        lastCall = now;
        pendingPromise = fn(...args);
        return pendingPromise;
    };
}
