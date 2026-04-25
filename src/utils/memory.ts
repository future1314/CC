/**
 * Memory management utilities
 */

export class MemoryManager {
  private static instance: MemoryManager;
  private memoryUsage: Map<string, number> = new Map();
  private maxMemoryThreshold = 100 * 1024 * 1024; // 100MB

  private constructor() {}

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  trackMemoryUsage(label: string, size: number): void {
    this.memoryUsage.set(label, (this.memoryUsage.get(label) || 0) + size);
    this.checkMemoryThreshold();
  }

  checkMemoryThreshold(): void {
    const totalUsage = Array.from(this.memoryUsage.values()).reduce((sum, size) => sum + size, 0);

    if (totalUsage > this.maxMemoryThreshold) {
      console.warn(`[MEMORY] High memory usage detected: ${(totalUsage / 1024 / 1024).toFixed(2)}MB`);
      this.cleanup();
    }
  }

  cleanup(): void {
    console.log('[MEMORY] Performing cleanup...');
    // 清理缓存
    this.memoryUsage.clear();
    // 可以在这里添加更多的清理逻辑
  }

  getMemoryUsage(): Map<string, number> {
    return new Map(this.memoryUsage);
  }
}

export function trackMemory(label: string, size: number): void {
  MemoryManager.getInstance().trackMemoryUsage(label, size);
}

export function monitorMemoryUsage(): void {
  const interval = setInterval(() => {
    const memoryUsage = process.memoryUsage();
    console.log(`[MEMORY] RSS: ${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB, Heap: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);

    if (memoryUsage.rss > 200 * 1024 * 1024) { // 200MB
      console.warn('[MEMORY] High memory usage detected, consider cleanup');
    }
  }, 60000); // 每分钟检查一次

  return () => clearInterval(interval);
}