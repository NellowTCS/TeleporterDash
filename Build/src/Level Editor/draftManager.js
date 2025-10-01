import { DatabaseManager } from "../Utilities/databaseManager";
import { GameState } from "../Utilities/gameState";
import { AudioManager } from "../Utilities/audioManager";
import { DOMManager } from "../Utilities/domManager.js";
import { createGrid, updateGridVisuals } from "./editorGrid.js";

// ===== Draft Management =====

export const DraftManager = {
  // // Create Draft Item Template
  createDraftItemTemplate(draft) {
    return `
      <span>${draft.title}</span>
      <span>${new Date(draft.lastModified).toLocaleString()}</span>
      <button onclick="loadDraft(${draft.id})">Load</button>
      <button onclick="deleteDraft(${draft.id})">Delete</button>
    `;
  },

  // // Save Draft
  async saveDraft(title = "Untitled Draft", levelNameInput, musicSelect) {
    try {
      const musicValue = musicSelect.value;
      const draftData = {
        title: levelNameInput.value || "untitled",
        matrix: GameState.current.editor.levelMatrix,
        author: DOMManager.getElement("#authorName").value || "Unknown Author",
        difficulty: DOMManager.getElement("#difficulty").value || "Normal",
        musicValue: musicValue || "level1.ogg",
        lastModified: new Date().toISOString(),
        customMusicFile: GameState.current.editor.customMusicFile,
        selectedColor: GameState.current.editor.selectedColor,
        selectedBlockColor: GameState.current.editor.selectedBlockColor,
      };

      // Debug log
      console.log("Saving draft data:", JSON.stringify(draftData));

      const draftId = await DatabaseManager.saveDraft(draftData);
      return draftId;
    } catch (error) {
      console.error("Error saving draft:", error);
      throw error;
    }
  },

  // // Load Draft
  async loadDraft(draftId, grid, gridContainer, levelNameInput, musicSelect, musicPreview, currentDraftIndicator) {
    try {
      const draft = await DatabaseManager.loadDraft(draftId);
      if (draft) {
        // Update current draft indicator
        GameState.setEditorState({ currentDraftId: draftId });
        currentDraftIndicator.style.display = "block";
        currentDraftIndicator.querySelector("span").textContent = draft.title;

        GameState.setEditorState({
          levelMatrix: draft.matrix,
          gridHeight: draft.matrix.length,
          gridWidth: draft.matrix[0].length,
        });

        // Update input values
        const gridWidthInput = DOMManager.getElement("#gridWidth");
        const gridHeightInput = DOMManager.getElement("#gridHeight");
        gridWidthInput.value = GameState.current.editor.gridWidth.toString();
        gridHeightInput.value = GameState.current.editor.gridHeight.toString();

        // Update grid container height
        const rowHeight = 55;
        const containerHeight =
          GameState.current.editor.gridHeight * rowHeight + 2;
        gridContainer.style.height = containerHeight + "px";

        // Update other fields with null checks
        if (levelNameInput) {
          levelNameInput.value = draft.title || "";
        }
        const authorNameEl = DOMManager.getElement("#authorName");
        if (authorNameEl) {
          authorNameEl.value = draft.author || "";
        }
        const difficultyEl = DOMManager.getElement("#difficulty");
        if (difficultyEl) {
          difficultyEl.value = draft.difficulty || "Normal";
        }

        // Update music selection and handle custom music
        await this.restoreDraftMusic(draft, musicSelect, musicPreview);

        // Restore color picker state
        this.restoreDraftColorState(draft);

        createGrid(grid);
        GameState.setEditorState({
          hasUnsavedChanges: false,
          lastExportedMatrix: null,
        });

        return draft;
      }
    } catch (error) {
      console.error("Error loading draft:", error);
      throw error;
    }
  },

  // // Restore Draft Music
  async restoreDraftMusic(draft, musicSelect, musicPreview) {
    if (
      draft.musicValue === "custom" &&
      draft.customMusicFile &&
      draft.customMusicFile.data
    ) {
      try {
        GameState.setEditorState({ customMusicFile: draft.customMusicFile });

        // Create blob for playback
        const audioUrl = AudioManager.createCustomMusicBlob(
          draft.customMusicFile
        );

        // Add custom option to select
        const option = document.createElement("option");
        option.value = "custom";
        option.text = "Custom: " + draft.customMusicFile.name;

        // Remove any existing custom option
        Array.from(musicSelect.options).forEach((opt) => {
          if (opt.value === "custom") musicSelect.removeChild(opt);
        });

        musicSelect.add(option);
        musicSelect.value = "custom";

        // Update audio preview - set the source before revoking old URL
        const oldSrc = musicPreview.src;
        musicPreview.src = audioUrl;

        // Now safe to revoke old URL if it was a blob
        if (oldSrc.startsWith("blob:")) {
          URL.revokeObjectURL(oldSrc);
        }

        console.log("Custom music loaded successfully:", {
          name: draft.customMusicFile.name,
          type: draft.customMusicFile.type,
          dataSize: draft.customMusicFile.data.byteLength,
          url: audioUrl,
        });
      } catch (error) {
        console.error("Error loading custom music:", error);
        GameState.setEditorState({ customMusicFile: null });
        musicSelect.value = "level1.ogg";
        musicPreview.src = "../Sound/Level Soundtracks/level1.ogg";
      }
    } else {
      GameState.setEditorState({ customMusicFile: null });
      musicSelect.value = draft.musicValue || "level1.ogg";
      musicPreview.src = `../Sound/Level Soundtracks/${draft.musicValue}`;
    }
  },

  // // Restore Draft Color State
  restoreDraftColorState(draft) {
    if (draft.selectedColor !== undefined) {
      GameState.setEditorState({ selectedColor: draft.selectedColor });
      const sectionColorPicker = DOMManager.getElement("#colorPicker");
      sectionColorPicker.value = draft.selectedColor.toString();
    }
    if (draft.selectedBlockColor !== undefined) {
      GameState.setEditorState({ selectedBlockColor: draft.selectedBlockColor });
      const blockColorPicker = DOMManager.getElement("#blockColorPicker");
      blockColorPicker.value = draft.selectedBlockColor.toString();
    }
  },

  // // Delete Draft
  async deleteDraft(draftId) {
    try {
      await DatabaseManager.deleteDraft(draftId);
      return true;
    } catch (error) {
      console.error("Error deleting draft:", error);
      throw error;
    }
  },

  // // Load Drafts List
  async loadDraftsList() {
    try {
      const drafts = await DatabaseManager.getDrafts();
      // Sort by lastModified in descending order (most recent first)
      drafts.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
      return drafts;
    } catch (error) {
      console.error("Error loading drafts list:", error);
      throw error;
    }
  },

  // // Auto Save Drafts
  scheduleAutoSave(callback) {
    const autoSaveTimeout = setTimeout(() => {
      if (GameState.current.editor.hasUnsavedChanges) {
        callback();
      }
    }, 30000); // Auto-save after 30 seconds of inactivity
    return autoSaveTimeout;
  },

  // // Clear Current Draft Indicator
  clearCurrentDraftIndicator(currentDraftIndicator) {
    GameState.setEditorState({ currentDraftId: null });
    currentDraftIndicator.style.display = "none";
    GameState.setEditorState({ hasUnsavedChanges: true });
  },

  // ===== Wrapper Functions for Global Access =====

  // // Save Draft (wrapper)
  async saveDraftWrapper(title = "Untitled Draft") {
    const levelNameInput = DOMManager.getElement("#levelName");
    const musicSelect = DOMManager.getElement("#musicSelect");
    return await DraftManager.saveDraft(title, levelNameInput, musicSelect);
  },

  // // Load Draft (wrapper for global access)
  async loadDraftWrapper(draftId) {
    const grid = DOMManager.getElement("#grid");
    const gridContainer = DOMManager.getElement("#gridContainer");
    const levelNameInput = DOMManager.getElement("#levelNameInput");
    const musicSelect = DOMManager.getElement("#musicSelect");
    const musicPreview = DOMManager.getElement("#musicPreview");
    const currentDraftIndicator = DOMManager.getElement("#currentDraftIndicator");

    return await DraftManager.loadDraft(
      draftId,
      grid,
      gridContainer,
      levelNameInput,
      musicSelect,
      musicPreview,
      currentDraftIndicator
    );
  },

  // // Delete Draft (wrapper for global access)
  async deleteDraftWrapper(draftId) {
    return await DraftManager.deleteDraft(draftId);
  },

  // // Load Drafts List (wrapper with DOM manipulation)
  async loadDraftsListWrapper() {
    try {
      const drafts = await DraftManager.loadDraftsList();
      const draftsList = DOMManager.getElement("#draftsList");
      if (!draftsList) {
        console.error("Element with ID 'draftsList' not found");
        return [];
      }
      draftsList.innerHTML = "";

      drafts.forEach((draft) => {
        const draftElement = document.createElement("div");
        draftElement.className = "draft-item";
        draftElement.innerHTML = DraftManager.createDraftItemTemplate(draft);
        draftsList.appendChild(draftElement);
      });

      return drafts;
    } catch (error) {
      console.error("Error loading drafts list:", error);
      throw error;
    }
  },

  // // Schedule Auto Save (wrapper)
  scheduleAutoSaveWrapper() {
    return DraftManager.scheduleAutoSave(async () => {
      if (GameState.current.editor.hasUnsavedChanges) {
        try {
          await DraftManager.saveDraftWrapper();
        } catch (error) {
          console.error("Auto-save failed:", error);
        }
      }
    });
  },

  // // Clear Current Draft Indicator (wrapper)
  clearCurrentDraftIndicatorWrapper() {
    const currentDraftIndicator = DOMManager.getElement("#currentDraftIndicator");
    DraftManager.clearCurrentDraftIndicator(currentDraftIndicator);
  },
};