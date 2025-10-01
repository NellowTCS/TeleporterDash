// Notification Manager using vanilla-toast
// Provides user-friendly toast notifications for errors and loading issues
import { vanillaToast } from 'vanilla-toast';
import 'vanilla-toast/vanilla-toast.css';

/**
 * Shows a loading error notification
 * @param {string} message - The error message to display
 * @param {Object} options - Additional options for the toast
 */
export function showLoadingError(message, options = {}) {
  const defaultOptions = {
    duration: 4000, // Longer duration for loading errors
    fadeDuration: 500,
    closeButton: true,
    className: 'error'
  };

  const toastOptions = { ...defaultOptions, ...options };

  // Use vanillaToast.show for loading errors with error styling
  if (vanillaToast) {
    vanillaToast.show(message, toastOptions);
  } else {
    // Fallback if vanilla-toast is not loaded
    console.error('Loading Error:', message);
    alert('Loading Error: ' + message);
  }
}

/**
 * Shows a general error notification
 * @param {string} message - The error message to display
 * @param {Object} options - Additional options for the toast
 */
export function showError(message, options = {}) {
  const defaultOptions = {
    duration: 3000,
    fadeDuration: 400,
    closeButton: true,
    className: 'error'
  };

  const toastOptions = { ...defaultOptions, ...options };

  // Use vanillaToast.show for general errors with error styling
  if (vanillaToast) {
    vanillaToast.show(message, toastOptions);
  } else {
    // Fallback if vanilla-toast is not loaded
    console.error('Error:', message);
    alert('Error: ' + message);
  }
}