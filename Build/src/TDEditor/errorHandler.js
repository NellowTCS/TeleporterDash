// Level Editor: Error Handler
// Centralized error handling and user notifications

import { DOMManager } from "../Utilities/domManager.js";

export class ErrorHandler {
  static instance = null;

  constructor() {
    if (ErrorHandler.instance) {
      return ErrorHandler.instance;
    }

    this.errorContainer = null;
    this.setupErrorContainer();
    ErrorHandler.instance = this;
  }

  setupErrorContainer() {
    // Create a container for error messages if it doesn't exist
    let container = document.getElementById("error-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "error-container";
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        max-width: 400px;
      `;
      document.body.appendChild(container);
    }
    this.errorContainer = container;
  }

  // ===== Error Notification Methods =====
  showError(title, message, type = "error", duration = 8000) {
    const errorElement = this.createErrorElement(title, message, type);
    this.errorContainer.appendChild(errorElement);

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        this.removeError(errorElement);
      }, duration);
    }

    return errorElement;
  }

  showWarning(title, message, duration = 6000) {
    return this.showError(title, message, "warning", duration);
  }

  showInfo(title, message, duration = 4000) {
    return this.showError(title, message, "info", duration);
  }

  showSuccess(title, message, duration = 3000) {
    return this.showError(title, message, "success", duration);
  }

  createErrorElement(title, message, type) {
    const element = document.createElement("div");

    const colors = {
      error: { bg: "#ffebee", border: "#f44336", text: "#c62828" },
      warning: { bg: "#fff3e0", border: "#ff9800", text: "#ef6c00" },
      info: { bg: "#e3f2fd", border: "#2196f3", text: "#1565c0" },
      success: { bg: "#e8f5e8", border: "#4caf50", text: "#2e7d32" },
    };

    const color = colors[type] || colors.error;

    element.style.cssText = `
      background: ${color.bg};
      border: 2px solid ${color.border};
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 10px;
      color: ${color.text};
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: slideIn 0.3s ease-out;
    `;

    element.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div style="flex-grow: 1;">
          <div style="font-weight: bold; margin-bottom: 4px;">${title}</div>
          <div style="font-size: 14px; line-height: 1.4;">${message}</div>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" 
                style="background: none; border: none; font-size: 18px; cursor: pointer; color: ${color.text}; margin-left: 10px;">
          X
        </button>
      </div>
    `;

    return element;
  }

  removeError(errorElement) {
    if (errorElement && errorElement.parentElement) {
      errorElement.style.animation = "slideOut 0.3s ease-in forwards";
      setTimeout(() => {
        if (errorElement.parentElement) {
          errorElement.parentElement.removeChild(errorElement);
        }
      }, 300);
    }
  }

  clearAllErrors() {
    while (this.errorContainer.firstChild) {
      this.errorContainer.removeChild(this.errorContainer.firstChild);
    }
  }

  // ===== Error Handling Utilities =====
  static handleAsyncError(asyncFunction, context = "Operation") {
    return async (...args) => {
      try {
        return await asyncFunction(...args);
      } catch (error) {
        console.error(`${context} failed:`, error);

        const handler = new ErrorHandler();
        handler.showError(
          `${context} Failed`,
          error.message || "An unexpected error occurred. Please try again.",
          "error",
        );

        throw error; // Re-throw for additional handling if needed
      }
    };
  }

  static wrapWithErrorHandling(fn, context = "Operation") {
    return (...args) => {
      try {
        const result = fn(...args);

        // Handle async functions
        if (result && typeof result.then === "function") {
          return ErrorHandler.handleAsyncError(async () => result, context)();
        }

        return result;
      } catch (error) {
        console.error(`${context} failed:`, error);

        const handler = new ErrorHandler();
        handler.showError(
          `${context} Failed`,
          error.message || "An unexpected error occurred. Please try again.",
          "error",
        );

        throw error;
      }
    };
  }

  // ===== Validation Helpers =====
  static validateRequired(value, fieldName) {
    if (!value || (typeof value === "string" && value.trim() === "")) {
      throw new Error(`${fieldName} is required`);
    }
    return value;
  }

  static validateMatrix(matrix) {
    if (!Array.isArray(matrix)) {
      throw new Error("Level matrix must be an array");
    }

    if (matrix.length === 0) {
      throw new Error("Level matrix cannot be empty");
    }

    if (!Array.isArray(matrix[0])) {
      throw new Error("Level matrix rows must be arrays");
    }

    const width = matrix[0].length;
    for (let i = 0; i < matrix.length; i++) {
      if (!Array.isArray(matrix[i]) || matrix[i].length !== width) {
        throw new Error(
          `All matrix rows must have the same width (expected ${width}, got ${matrix[i].length} at row ${i})`,
        );
      }
    }

    return matrix;
  }

  static validateFileType(file, allowedTypes) {
    if (
      !allowedTypes.some(
        (type) =>
          file.name.endsWith(type) || file.type.includes(type.replace(".", "")),
      )
    ) {
      throw new Error(
        `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`,
      );
    }
    return file;
  }
}

// Add CSS animations for notifications
if (!document.getElementById("error-handler-styles")) {
  const style = document.createElement("style");
  style.id = "error-handler-styles";
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

export default ErrorHandler;
