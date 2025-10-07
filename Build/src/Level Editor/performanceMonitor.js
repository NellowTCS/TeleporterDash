// Level Editor: Performance Monitor
// Utilities for monitoring and optimizing performance

export class PerformanceMonitor {
  static instance = null;
  
  constructor() {
    if (PerformanceMonitor.instance) {
      return PerformanceMonitor.instance;
    }
    
    this.timers = new Map();
    this.memoryStats = [];
    this.renderStats = [];
    this.isMonitoring = false;
    
    PerformanceMonitor.instance = this;
  }

  // ===== Timing Utilities =====
  startTimer(name) {
    this.timers.set(name, performance.now());
  }

  endTimer(name, logResult = false) {
    const startTime = this.timers.get(name);
    if (startTime) {
      const duration = performance.now() - startTime;
      this.timers.delete(name);
      
      if (logResult) {
        console.log(`${name}: ${duration.toFixed(2)}ms`);
      }
      
      return duration;
    }
    return 0;
  }

  // ===== Debouncing Utility =====
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // ===== Throttling Utility =====
  static throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // ===== Memory Monitoring =====
  trackMemoryUsage() {
    if ('memory' in performance) {
      // @ts-ignore - performance.memory is a non-standard but widely supported property
      const memInfo = performance.memory;
      this.memoryStats.push({
        timestamp: Date.now(),
        // @ts-ignore
        used: memInfo.usedJSHeapSize,
        // @ts-ignore  
        total: memInfo.totalJSHeapSize,
        // @ts-ignore
        limit: memInfo.jsHeapSizeLimit
      });
      
      // Keep only last 100 measurements
      if (this.memoryStats.length > 100) {
        this.memoryStats.shift();
      }
    }
  }

  getMemoryStats() {
    if (this.memoryStats.length === 0) return null;
    
    const latest = this.memoryStats[this.memoryStats.length - 1];
    return {
      current: this.formatBytes(latest.used),
      total: this.formatBytes(latest.total),
      limit: this.formatBytes(latest.limit),
      percentage: ((latest.used / latest.limit) * 100).toFixed(1)
    };
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // ===== Grid Performance Optimization =====
  static createOptimizedGridRenderer(container) {
    let animationFrame = null;
    let pendingUpdates = new Set();
    
    const updateCell = (cell, value) => {
      pendingUpdates.add({ cell, value });
      
      if (!animationFrame) {
        animationFrame = requestAnimationFrame(() => {
          // Batch update all pending cells
          const updates = Array.from(pendingUpdates);
          pendingUpdates.clear();
          
          // Use document fragment for efficient DOM updates
          const fragment = document.createDocumentFragment();
          
          updates.forEach(({ cell, value }) => {
            cell.dataset.value = value.toString();
            // Apply visual updates here
          });
          
          animationFrame = null;
        });
      }
    };
    
    return { updateCell };
  }

  // ===== Event Listener Optimization =====
  static createEventDelegator(container, eventType, selector, handler) {
    container.addEventListener(eventType, (e) => {
      if (e.target.matches(selector)) {
        handler(e);
      }
    });
  }

  // ===== State Change Optimization =====
  static createStateManager() {
    let state = {};
    let listeners = [];
    let batchTimeout = null;
    let pendingChanges = {};
    
    const notifyListeners = () => {
      const changes = { ...pendingChanges };
      pendingChanges = {};
      
      listeners.forEach(listener => {
        listener(changes, state);
      });
    };
    
    return {
      setState(updates) {
        Object.assign(pendingChanges, updates);
        Object.assign(state, updates);
        
        if (batchTimeout) clearTimeout(batchTimeout);
        batchTimeout = setTimeout(notifyListeners, 0);
      },
      
      getState() {
        return { ...state };
      },
      
      subscribe(listener) {
        listeners.push(listener);
        return () => {
          const index = listeners.indexOf(listener);
          if (index > -1) listeners.splice(index, 1);
        };
      }
    };
  }

  // ===== Resource Cleanup =====
  static createResourceManager() {
    const resources = new Set();
    
    return {
      track(resource) {
        resources.add(resource);
      },
      
      cleanup() {
        resources.forEach(resource => {
          if (typeof resource === 'function') {
            resource();
          } else if (resource && typeof resource.cleanup === 'function') {
            resource.cleanup();
          } else if (resource && typeof resource.removeEventListener === 'function') {
            // It's an event listener - would need the specific event and function
          }
        });
        resources.clear();
      }
    };
  }

  // ===== Monitoring Control =====
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.trackMemoryUsage();
    }, 5000);
    
    console.log('Performance monitoring started');
  }

  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    console.log('Performance monitoring stopped');
  }

  getPerformanceReport() {
    return {
      memory: this.getMemoryStats(),
      isMonitoring: this.isMonitoring,
      totalTimers: this.timers.size,
      memoryDataPoints: this.memoryStats.length
    };
  }
}