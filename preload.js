const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getKeys: (filters) => ipcRenderer.invoke("get-keys", filters || {}),
  createKeys: (payload) => ipcRenderer.invoke("create-keys", payload),
  deleteKey: (id) => ipcRenderer.invoke("delete-key", id),
  deleteUnusedKeys: (payload) =>
    ipcRenderer.invoke("delete-unused-keys", payload),
  deleteAllKeys: (payload) =>
    ipcRenderer.invoke("delete-all-keys", payload),
    exportKeys: (payload) => ipcRenderer.invoke("export-keys", payload),
    openAnty: () => ipcRenderer.invoke("open-anty"),
    openVip: () => ipcRenderer.invoke("open-vip"),
    createAntyKeys: (payload) => ipcRenderer.invoke("create-anty-keys", payload),
    getAntyKeys: (filters) => ipcRenderer.invoke("get-anty-keys", filters || {}),
    deleteAntyKey: (id) => ipcRenderer.invoke("delete-anty-key", id),
    bulkInsertKeys: (payload) => ipcRenderer.invoke("bulk-insert-keys", payload),
    deleteManyKeys: (ids) => ipcRenderer.invoke("delete-many-keys", ids),
    getAntyUsers: (filters) => ipcRenderer.invoke("getAntyUsers", filters || {}),
    updateAntyUser: (payload) => ipcRenderer.invoke("updateAntyUser", payload),
    restoreAntyMachine: (payload) => ipcRenderer.invoke("restoreAntyMachine", payload),
    insertAntyKeys: (keys, planType, validadeDias) =>
        ipcRenderer.invoke("insert-anty-keys", keys, planType, validadeDias),
        adminLogin: (data) => ipcRenderer.invoke("admin-login", data),

  // users
  getUsers: () => ipcRenderer.invoke("get-users"),
  toggleUserFlag: (data) => ipcRenderer.invoke("toggle-user-flag", data),
  updateUserExpiration: (data) =>
    ipcRenderer.invoke("update-user-expiration", data),

  // blacklist
  getBlacklist: () => ipcRenderer.invoke("get-blacklist"),
  addBlacklist: (data) => ipcRenderer.invoke("add-blacklist", data),
  deactivateBlacklist: (id) => ipcRenderer.invoke("deactivate-blacklist", id),
  setBlacklistActive: (data) =>
        ipcRenderer.invoke("set-blacklist-active", data),
  deleteBlacklist: (id) => ipcRenderer.invoke("delete-blacklist", id),

  // links externos
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
});
