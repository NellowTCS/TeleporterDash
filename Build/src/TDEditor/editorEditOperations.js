import { GameState } from "../Utilities/gameState.js";
import { DOMManager } from "../Utilities/domManager.js";
import { updateGridVisuals } from "./editorGrid.js";

// ===== Edit Operations Manager =====
// Handles undo/redo, copy/paste, selection, and related operations

class EditOperationsManager {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
    this.clipboard = null;
    this.selection = {
      active: false,
      start: null,
      end: null
    };
    this.isSelecting = false;
    this.contextMenu = null;
    this.maxUndoSteps = 50; // Increased from 20 for better user experience
    this.lastMousePosition = { row: 1, col: 0 }; // Track cursor position for pasting
    
    this.initialize();
  }

  // ===== Initialization =====
  initialize() {
    this.setupEventListeners();
    this.createContextMenu();
    this.saveInitialState();
  }

  // Save initial state when grid is created
  saveInitialState() {
    if (GameState.current.editor.levelMatrix && GameState.current.editor.levelMatrix.length > 0) {
      this.saveState();
    }
  }

  // ===== State Management =====
  saveState() {
    if (!GameState.current.editor.levelMatrix) return;
    
    // Create deep copy of current matrix
    const currentMatrix = JSON.parse(JSON.stringify(GameState.current.editor.levelMatrix));
    
    // Only save if different from last saved state
    const lastState = this.undoStack[this.undoStack.length - 1];
    if (!lastState || JSON.stringify(lastState) !== JSON.stringify(currentMatrix)) {
      this.undoStack.push(currentMatrix);
      this.redoStack = []; // Clear redo stack on new action
      
      // Limit history to prevent memory issues
      if (this.undoStack.length > this.maxUndoSteps) {
        this.undoStack.shift();
      }
    }
  }

  undo() {
    if (this.undoStack.length <= 1) return false; // Keep at least one state
    
    // Move current state to redo stack
    const currentMatrix = JSON.parse(JSON.stringify(GameState.current.editor.levelMatrix));
    this.redoStack.push(currentMatrix);
    
    // Restore previous state
    const previousState = this.undoStack.pop();
    GameState.setEditorState({ levelMatrix: previousState });
    updateGridVisuals();
    this.clearSelection();
    
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    
    // Save current state to undo stack
    const currentMatrix = JSON.parse(JSON.stringify(GameState.current.editor.levelMatrix));
    this.undoStack.push(currentMatrix);
    
    // Restore next state
    const nextState = this.redoStack.pop();
    GameState.setEditorState({ levelMatrix: nextState });
    updateGridVisuals();
    this.clearSelection();
    
    return true;
  }

  // ===== Selection Management =====
  startSelection(row, col) {
    // Don't start selection on color row (row 0)
    if (row === 0) return;
    
    this.selection.start = { row, col };
    this.selection.end = { row, col };
    this.selection.active = true;
    this.updateSelectionDisplay();
  }

  updateSelection(row, col) {
    if (!this.selection.active || !this.selection.start) return;
    
    // Ensure selection stays within grid boundaries
    const maxRow = GameState.current.editor.gridHeight - 1;
    const maxCol = GameState.current.editor.gridWidth - 1;
    
    row = Math.max(0, Math.min(row, maxRow));
    col = Math.max(0, Math.min(col, maxCol));
    
    this.selection.end = { row, col };
    this.updateSelectionDisplay();
  }

  clearSelection() {
    this.selection.active = false;
    this.selection.start = null;
    this.selection.end = null;
    document.querySelectorAll('.cell.selected').forEach(cell => {
      cell.classList.remove('selected');
    });
  }

  selectAll() {
    // Start from row 1 to skip color row
    this.selection.start = { row: 1, col: 0 };
    this.selection.end = { 
      row: GameState.current.editor.gridHeight - 1, 
      col: GameState.current.editor.gridWidth - 1 
    };
    this.selection.active = true;
    this.updateSelectionDisplay();
  }

  updateSelectionDisplay() {
    if (!this.selection.active || !this.selection.start || !this.selection.end) {
      this.clearSelection();
      return;
    }

    const minRow = Math.max(1, Math.min(this.selection.start.row, this.selection.end.row)); // Skip row 0
    const maxRow = Math.max(this.selection.start.row, this.selection.end.row);
    const minCol = Math.min(this.selection.start.col, this.selection.end.col);
    const maxCol = Math.max(this.selection.start.col, this.selection.end.col);

    document.querySelectorAll('.cell').forEach(cell => {
      const row = parseInt(cell.getAttribute('data-row') || '0');
      const col = parseInt(cell.getAttribute('data-col') || '0');
      
      // Don't select color row (row 0)
      const inSelection = row > 0 && row >= minRow && row <= maxRow && 
                         col >= minCol && col <= maxCol;
      
      cell.classList.toggle('selected', inSelection);
    });
  }

  getSelection() {
    if (!this.selection.active || !this.selection.start || !this.selection.end) {
      return null;
    }

    const minRow = Math.min(this.selection.start.row, this.selection.end.row);
    const maxRow = Math.max(this.selection.start.row, this.selection.end.row);
    const minCol = Math.min(this.selection.start.col, this.selection.end.col);
    const maxCol = Math.max(this.selection.start.col, this.selection.end.col);

    const data = [];
    for (let r = minRow; r <= maxRow; r++) {
      const row = [];
      for (let c = minCol; c <= maxCol; c++) {
        row.push(GameState.current.editor.levelMatrix[r]?.[c] || 0);
      }
      data.push(row);
    }

    return {
      data,
      rows: maxRow - minRow + 1,
      cols: maxCol - minCol + 1,
      startRow: minRow,
      startCol: minCol
    };
  }

  // ===== Copy/Paste Operations =====
  copySelection() {
    const selection = this.getSelection();
    if (selection) {
      this.clipboard = selection;
      this.showNotification("Selection copied to clipboard");
      return true;
    }
    this.showNotification("Select some cells first", "warning");
    return false;
  }

  cutSelection() {
    if (this.copySelection()) {
      this.deleteSelection();
      this.showNotification("Selection cut to clipboard");
      return true;
    }
    return false;
  }

  pasteSelection(targetRow = null, targetCol = null) {
    if (!this.clipboard) {
      this.showNotification("Nothing to paste", "error");
      return false;
    }

    // Determine paste position
    let pasteRow, pasteCol;
    
    if (targetRow !== null && targetCol !== null) {
      pasteRow = targetRow;
      pasteCol = targetCol;
    } else if (this.lastMousePosition) {
      // Paste at cursor position
      pasteRow = this.lastMousePosition.row;
      pasteCol = this.lastMousePosition.col;
    } else if (this.selection.active && this.selection.start) {
      pasteRow = this.selection.start.row;
      pasteCol = this.selection.start.col;
    } else {
      // Default to row 1, col 0 (skip color row)
      pasteRow = 1;
      pasteCol = 0;
    }

    // Save state before pasting
    this.saveState();

    // Paste clipboard data
    let pastedCells = 0;
    for (let r = 0; r < this.clipboard.rows; r++) {
      for (let c = 0; c < this.clipboard.cols; c++) {
        const targetR = pasteRow + r;
        const targetC = pasteCol + c;
        
        // Check boundaries
        if (targetR >= 0 && targetR < GameState.current.editor.gridHeight && 
            targetC >= 0 && targetC < GameState.current.editor.gridWidth) {
          GameState.current.editor.levelMatrix[targetR][targetC] = this.clipboard.data[r][c];
          pastedCells++;
        }
      }
    }

    if (pastedCells > 0) {
      updateGridVisuals();
      const startRow = Math.max(1, pasteRow);
      const startCol = Math.max(0, pasteCol);
      const endRow = Math.min(
        GameState.current.editor.gridHeight - 1,
        pasteRow + this.clipboard.rows - 1
      );
      const endCol = Math.min(
        GameState.current.editor.gridWidth - 1,
        pasteCol + this.clipboard.cols - 1
      );
      this.selection = {
        active: true,
        start: { row: startRow, col: startCol },
        end: { row: endRow, col: endCol }
      };
      this.updateSelectionDisplay();
      this.lastMousePosition = { row: startRow, col: startCol };
      this.showNotification(`Pasted ${pastedCells} cells at row ${pasteRow + 1}, col ${pasteCol + 1}`);
      return true;
    } else {
      this.showNotification("Could not paste - outside grid boundaries", "error");
      return false;
    }
  }

  deleteSelection() {
    const selection = this.getSelection();
    if (!selection) {
      this.showNotification("Nothing selected to delete", "warning");
      return false;
    }

    this.saveState();

    // Clear selected cells
    for (let r = selection.startRow; r < selection.startRow + selection.rows; r++) {
      for (let c = selection.startCol; c < selection.startCol + selection.cols; c++) {
        if (r >= 0 && r < GameState.current.editor.gridHeight && 
            c >= 0 && c < GameState.current.editor.gridWidth) {
          GameState.current.editor.levelMatrix[r][c] = 0; // Set to empty
        }
      }
    }

    updateGridVisuals();
    this.updateSelectionDisplay();
    this.showNotification("Selection cleared");
    return true;
  }

  // ===== Context Menu =====
  createContextMenu() {
    // Remove existing context menu if it exists
    const existingMenu = document.getElementById('editorContextMenu');
    if (existingMenu) {
      existingMenu.remove();
    }

    this.contextMenu = document.createElement('div');
    this.contextMenu.id = 'editorContextMenu';
    this.contextMenu.className = 'context-menu';
    this.contextMenu.style.cssText = `
      position: absolute;
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 4px 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      z-index: 10000;
      display: none;
      min-width: 120px;
    `;

    const menuItems = [
      { text: 'Cut', shortcut: 'Ctrl+X', action: () => this.cutSelection() },
      { text: 'Copy', shortcut: 'Ctrl+C', action: () => this.copySelection() },
      { text: 'Paste', shortcut: 'Ctrl+V', action: () => this.pasteSelection() },
      { text: '---', action: null }, // Separator
      { text: 'Delete', shortcut: 'Del', action: () => this.deleteSelection() },
      { text: 'Select All', shortcut: 'Ctrl+A', action: () => this.selectAll() }
    ];

    menuItems.forEach(item => {
      if (item.text === '---') {
        const separator = document.createElement('div');
        separator.style.cssText = 'height: 1px; background: #eee; margin: 4px 0;';
        this.contextMenu.appendChild(separator);
      } else {
        const menuItem = document.createElement('div');
        menuItem.className = 'context-menu-item';
        menuItem.style.cssText = `
          padding: 6px 12px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
        `;
        
        menuItem.innerHTML = `
          <span>${item.text}</span>
          ${item.shortcut ? `<span style="color: #666; font-size: 0.8em;">${item.shortcut}</span>` : ''}
        `;
        
        menuItem.addEventListener('mouseenter', () => {
          menuItem.style.backgroundColor = '#f0f0f0';
        });
        
        menuItem.addEventListener('mouseleave', () => {
          menuItem.style.backgroundColor = '';
        });
        
        menuItem.addEventListener('click', () => {
          if (item.action) item.action();
          this.hideContextMenu();
        });
        
        this.contextMenu.appendChild(menuItem);
      }
    });

    document.body.appendChild(this.contextMenu);
  }

  showContextMenu(x, y) {
    this.contextMenu.style.left = x + 'px';
    this.contextMenu.style.top = y + 'px';
    this.contextMenu.style.display = 'block';
    
    // Adjust position if menu goes off screen
    const rect = this.contextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      this.contextMenu.style.left = (x - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      this.contextMenu.style.top = (y - rect.height) + 'px';
    }
  }

  hideContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.style.display = 'none';
    }
  }

  // ===== Event Listeners =====
  setupEventListeners() {
    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      // Hide context menu on any key press
      this.hideContextMenu();
      
      if (e.ctrlKey || e.metaKey) {
        switch(e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              this.redo();
            } else {
              this.undo();
            }
            break;
          case 'y':
            e.preventDefault();
            this.redo();
            break;
          case 'c':
            e.preventDefault();
            this.copySelection();
            break;
          case 'x':
            e.preventDefault();
            this.cutSelection();
            break;
          case 'v':
            e.preventDefault();
            this.pasteSelection();
            break;
          case 'a':
            e.preventDefault();
            this.selectAll();
            break;
        }
      } else {
        // Non-Ctrl keys
        switch(e.key) {
          case 'Delete':
            e.preventDefault();
            this.deleteSelection();
            break;
          case 'Escape':
            e.preventDefault();
            this.clearSelection();
            break;
        }
      }
    });

    // Mouse selection handling
    DOMManager.addEvent("#grid", "mousedown", (e) => {
      // Hide context menu on any click
      this.hideContextMenu();
      
      if (e.target.classList && e.target.classList.contains('cell')) {
        const row = parseInt(e.target.getAttribute('data-row') || '0');
        const col = parseInt(e.target.getAttribute('data-col') || '0');
        const tool = GameState.current.editor.currentTool;
        const isSelectTool = tool === 'select';
        const modifierSelect = tool === '0' && (e.shiftKey || e.ctrlKey || e.metaKey);
        
        // Track mouse position for pasting (skip color row)
        if (row > 0) {
          this.lastMousePosition = { row, col };
        }
        
        if (isSelectTool || modifierSelect) {
          e.preventDefault();
          e.stopPropagation();
          this.isSelecting = true;
          if (this.selection.active && this.selection.start && (e.shiftKey || e.ctrlKey || e.metaKey)) {
            this.updateSelection(row, col);
          } else {
            this.startSelection(row, col);
          }
        } else if (!e.shiftKey && !e.ctrlKey && !e.metaKey && !isSelectTool) {
          // Regular click with non-select tools clears selection
          this.clearSelection();
        }
      }
    });

    DOMManager.addEvent("#grid", "mouseover", (e) => {
      // Always track mouse position for pasting
      if (e.target.classList && e.target.classList.contains('cell')) {
        const row = parseInt(e.target.getAttribute('data-row') || '0');
        const col = parseInt(e.target.getAttribute('data-col') || '0');
        
        // Only update position if it's not the color row
        if (row > 0) {
          this.lastMousePosition = { row, col };
        }
      }
      
      if (this.isSelecting && e.target.classList && e.target.classList.contains('cell')) {
        e.preventDefault();
        e.stopPropagation();
        const row = parseInt(e.target.getAttribute('data-row') || '0');
        const col = parseInt(e.target.getAttribute('data-col') || '0');
        this.updateSelection(row, col);
      }
    });

    document.addEventListener("mouseup", () => {
      this.isSelecting = false;
    });

    // Context menu handling
    DOMManager.addEvent("#grid", "contextmenu", (e) => {
      if (e.target.classList && e.target.classList.contains('cell')) {
        e.preventDefault();
        
        const row = parseInt(e.target.getAttribute('data-row') || '0');
        const col = parseInt(e.target.getAttribute('data-col') || '0');
        
        // If not selecting on right-click cell, select it
        if (!this.selection.active) {
          this.startSelection(row, col);
        }
        
        this.showContextMenu(e.pageX, e.pageY);
      }
    });

    // Hide context menu on outside click
    document.addEventListener("click", (e) => {
      if (!(e.target instanceof Node) || !this.contextMenu.contains(e.target)) {
        this.hideContextMenu();
      }
    });

    // Button event listeners
    DOMManager.addEvent("#undoBtn", "click", () => this.undo());
    DOMManager.addEvent("#redoBtn", "click", () => this.redo());
    DOMManager.addEvent("#copyBtn", "click", () => this.copySelection());
    DOMManager.addEvent("#pasteBtn", "click", () => this.pasteSelection());
  }

  // ===== Utility Functions =====
  showNotification(message, type = "info") {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('editNotification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'editNotification';
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 10px 15px;
        border-radius: 4px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
      `;
      document.body.appendChild(notification);
    }

    // Set notification style based on type
    const colors = {
      info: '#2196F3',
      success: '#4CAF50',
      error: '#f44336',
      warning: '#FF9800'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    notification.textContent = message;
    
    // Show notification
    notification.style.transform = 'translateX(0)';
    
    // Hide after 2 seconds
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
    }, 2000);
  }

  // ===== Public API =====
  // Methods to be called from external modules
  
  // Called when cell changes to save state
  onCellChange() {
    // Use setTimeout to defer state saving until after the change is complete
    setTimeout(() => {
      this.saveState();
    }, 0);
  }
  
  // Called when grid is recreated
  onGridRecreated() {
    this.clearSelection();
    this.saveInitialState();
  }
  
  // Called when grid size changes
  onGridSizeChanged() {
    this.clearSelection();
    // Update selection boundaries if needed
    if (this.selection.active) {
      const maxRow = GameState.current.editor.gridHeight - 1;
      const maxCol = GameState.current.editor.gridWidth - 1;
      
      if (this.selection.end) {
        this.selection.end.row = Math.min(this.selection.end.row, maxRow);
        this.selection.end.col = Math.min(this.selection.end.col, maxCol);
      }
      
      this.updateSelectionDisplay();
    }
  }

  // Get current state for external access
  getState() {
    return {
      canUndo: this.undoStack.length > 1,
      canRedo: this.redoStack.length > 0,
      hasSelection: this.selection.active,
      hasClipboard: this.clipboard !== null
    };
  }
}

// Create and export singleton instance
export const EditOperations = new EditOperationsManager();

// Export individual functions for backward compatibility
export const {
  saveState: saveEditState,
  undo,
  redo,
  copySelection,
  pasteSelection,
  clearSelection,
  selectAll
} = EditOperations;