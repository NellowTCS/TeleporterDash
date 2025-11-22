// Database Manager for TeleporterDash
// Centralized IndexedDB operations

export const DatabaseManager = {
  db: null,
  DB_NAME: "TeleporterDashDB",
  DB_VERSION: 2,
  STORE_NAME: "downloadedLevels",
  DRAFTS_STORE: "levelDrafts",
  TEST_STORE: "testLevel",

  initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error("Failed to open database:", request.error);
        reject(request.error);
      };

      request.onsuccess = (event) => {
        this.db = /** @type {IDBOpenDBRequest} */ (event.target).result;
        console.log("Database opened successfully");
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = /** @type {IDBOpenDBRequest} */ (event.target).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: "filename" });
          console.log("Object store created");
        }
        if (!db.objectStoreNames.contains("scores")) {
          db.createObjectStore("scores");
          console.log("Scores object store created");
        }
        if (!db.objectStoreNames.contains(this.DRAFTS_STORE)) {
          db.createObjectStore(this.DRAFTS_STORE, {
            keyPath: "id",
            autoIncrement: true,
          });
          console.log("Drafts object store created");
        }
        if (!db.objectStoreNames.contains(this.TEST_STORE)) {
          db.createObjectStore(this.TEST_STORE, { keyPath: "id" });
          console.log("Test Levels object store created");
        }
      };
    });
  },

  async getDownloadedLevels() {
    if (!this.db) {
      try {
        await this.initDB();
      } catch (error) {
        console.error("Failed to initialize database:", error);
        return [];
      }
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([this.STORE_NAME], "readonly");
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          resolve(request.result || []);
        };

        request.onerror = () => {
          console.error("Error fetching downloaded levels:", request.error);
          reject(request.error);
        };
      } catch (error) {
        console.error("Error in transaction:", error);
        reject(error);
      }
    });
  },

  async loadFromIndexedDB(filename) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      try {
        const transaction = this.db.transaction([this.STORE_NAME], "readonly");
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.get(filename);

        request.onsuccess = () => {
          if (request.result) {
            resolve(request.result);
          } else {
            reject(new Error("Level not found in local storage"));
          }
        };

        request.onerror = () => {
          reject(request.error);
        };
      } catch (error) {
        reject(error);
      }
    });
  },

  async putLevel(levelData) {
    if (!this.db) {
      await this.initDB();
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], "readwrite");
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put(levelData);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  async deleteLevel(filename) {
    if (!this.db) {
      await this.initDB();
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], "readwrite");
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(filename);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  async hasLevel(filename) {
    if (!this.db) {
      await this.initDB();
    }
    return new Promise((resolve) => {
      const transaction = this.db.transaction([this.STORE_NAME], "readonly");
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(filename);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => resolve(false);
    });
  },

  async saveDraft(draftData) {
    if (!this.db) {
      await this.initDB();
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.DRAFTS_STORE], "readwrite");
      const store = transaction.objectStore(this.DRAFTS_STORE);
      const request = store.add(draftData);
      request.onsuccess = () => resolve(request.result); // Return the key (ID)
      request.onerror = () => reject(request.error);
    });
  },

  async getDrafts() {
    if (!this.db) {
      await this.initDB();
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.DRAFTS_STORE], "readonly");
      const store = transaction.objectStore(this.DRAFTS_STORE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async loadDraft(draftId) {
    if (!this.db) {
      await this.initDB();
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.DRAFTS_STORE], "readonly");
      const store = transaction.objectStore(this.DRAFTS_STORE);
      const request = store.get(draftId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async deleteDraft(draftId) {
    if (!this.db) {
      await this.initDB();
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.DRAFTS_STORE], "readwrite");
      const store = transaction.objectStore(this.DRAFTS_STORE);
      const request = store.delete(draftId);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  async saveTestLevel(testData) {
    if (!this.db) {
      await this.initDB();
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.TEST_STORE], "readwrite");
      const store = transaction.objectStore(this.TEST_STORE);
      const request = store.put(testData);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  async loadTestLevel(testId) {
    if (!this.db) {
      await this.initDB();
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.TEST_STORE], "readonly");
      const store = transaction.objectStore(this.TEST_STORE);
      const request = store.get(testId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
};

// Make it global
// @ts-ignore
window.DatabaseManager = DatabaseManager;
