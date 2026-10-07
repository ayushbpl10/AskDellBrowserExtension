// ============================================================
// tests/mock_chrome.js
// High-fidelity Mock Environment for Chrome Extension APIs
// ============================================================

class MockChrome {
  constructor() {
    this.storageData = {};
    this.tabsList = [];
    this.nextTabId = 100;
    this.messageListeners = [];
    this.connectListeners = [];
    this.installedListeners = [];
    this.contextMenuListeners = [];
    this.contextMenusCreated = [];
    this.tabUpdatedListeners = [];
    this.tabRemovedListeners = [];
    this.actionClickListeners = [];
    this.lastError = null;
    this.tabsResponses = {};
    this.tabsConnectPort = null;

    this.runtime = {
      onMessage: {
        addListener: (fn) => this.messageListeners.push(fn),
        hasListener: (fn) => this.messageListeners.includes(fn)
      },
      onConnect: {
        addListener: (fn) => this.connectListeners.push(fn)
      },
      onInstalled: {
        addListener: (fn) => this.installedListeners.push(fn)
      },
      sendMessage: (msg, callback) => {
        if (this.runtimeResponse !== undefined) {
          const resp = typeof this.runtimeResponse === "function" ? this.runtimeResponse(msg) : this.runtimeResponse;
          if (callback) callback(resp);
          return Promise.resolve(resp);
        }

        let responded = false;
        let responseValue = undefined;

        for (const listener of this.messageListeners) {
          const ret = listener(msg, { tab: null }, (res) => {
            responded = true;
            responseValue = res;
            if (callback) callback(res);
          });
          if (ret === true) {
            // async listener
          }
        }

        if (callback && !responded) {
          callback(responseValue);
        }
        return Promise.resolve(responseValue);
      },
      lastError: null
    };

    this.tabs = {
      query: (queryInfo, callback) => {
        let results = [...this.tabsList];
        if (queryInfo.url) {
          const urlPattern = queryInfo.url
            .replace(/\./g, "\\.")
            .replace(/\*/g, ".*")
            .replace(/\/\.\*$/, "(?:/.*)?");
          const re = new RegExp(urlPattern);
          results = results.filter((t) => re.test(t.url));
        }
        if (queryInfo.active !== undefined) {
          results = results.filter((t) => t.active === queryInfo.active);
        }
        if (callback) callback(results);
        return Promise.resolve(results);
      },
      create: (createProps, callback) => {
        const newTab = {
          id: ++this.nextTabId,
          url: createProps.url || "about:blank",
          active: createProps.active !== false,
          status: "complete",
          windowId: 1
        };
        this.tabsList.push(newTab);
        if (callback) callback(newTab);
        return Promise.resolve(newTab);
      },
      update: (tabId, updateProps, callback) => {
        const tab = this.tabsList.find((t) => t.id === tabId);
        if (tab) {
          Object.assign(tab, updateProps);
        }
        if (callback) callback(tab);
        return Promise.resolve(tab);
      },
      reload: (tabId, callback) => {
        const tab = this.tabsList.find((t) => t.id === tabId);
        if (tab) tab.status = "complete";
        if (callback) callback(tab);
        return Promise.resolve(tab);
      },
      connect: (tabId, connectInfo) => {
        if (typeof this.tabsConnectPort === "function") {
          return this.tabsConnectPort(tabId, connectInfo);
        }
        if (this.tabsConnectPort) return this.tabsConnectPort;
        return {
          name: connectInfo?.name || "",
          postMessage: () => {},
          onMessage: { addListener: () => {} },
          onDisconnect: { addListener: () => {} },
          disconnect: () => {}
        };
      },
      sendMessage: (tabId, msg, callback) => {
        const tab = this.tabsList.find((t) => t.id === tabId);
        if (!tab) {
          const err = new Error(`Could not establish connection to tab ${tabId}`);
          if (callback) callback({ error: err.message });
          return Promise.reject(err);
        }
        if (this.tabsResponses && this.tabsResponses[tabId] !== undefined) {
          try {
            const raw = this.tabsResponses[tabId];
            const resp = typeof raw === "function" ? raw(msg) : raw;
            if (callback) callback(resp);
            return Promise.resolve(resp);
          } catch (err) {
            return Promise.reject(err);
          }
        }
        if (tab.messageHandler) {
          const p = Promise.resolve(tab.messageHandler(msg));
          if (callback) p.then(callback);
          return p;
        }
        const defaultResp = { success: true };
        if (callback) callback(defaultResp);
        return Promise.resolve(defaultResp);
      },
      onUpdated: {
        addListener: (fn) => this.tabUpdatedListeners.push(fn)
      },
      onRemoved: {
        addListener: (fn) => this.tabRemovedListeners.push(fn)
      }
    };

    this.windows = {
      update: (winId, props) => Promise.resolve({ id: winId, ...props })
    };

    this.storage = {
      local: {
        get: (keys, callback) => {
          let result = {};
          if (typeof keys === "string") {
            result[keys] = this.storageData[keys];
          } else if (Array.isArray(keys)) {
            for (const k of keys) {
              if (this.storageData[k] !== undefined) result[k] = this.storageData[k];
            }
          } else if (keys === null || keys === undefined) {
            result = { ...this.storageData };
          }
          if (callback) callback(result);
          return Promise.resolve(result);
        },
        set: (items, callback) => {
          Object.assign(this.storageData, items);
          if (callback) callback();
          return Promise.resolve();
        },
        remove: (keys, callback) => {
          const arr = Array.isArray(keys) ? keys : [keys];
          for (const k of arr) delete this.storageData[k];
          if (callback) callback();
          return Promise.resolve();
        },
        clear: (callback) => {
          this.storageData = {};
          if (callback) callback();
          return Promise.resolve();
        }
      }
    };

    this.contextMenus = {
      create: (item, callback) => {
        this.contextMenusCreated.push(item);
        if (callback) callback();
      },
      onClicked: {
        addListener: (fn) => this.contextMenuListeners.push(fn)
      }
    };

    this.sidePanel = {
      open: (options) => Promise.resolve(),
      setPanelBehavior: (options) => Promise.resolve()
    };

    this.action = {
      onClicked: {
        addListener: (fn) => this.actionClickListeners.push(fn)
      }
    };

    this.scripting = {
      executeScript: ({ target, func }) => {
        try {
          const res = func();
          return Promise.resolve([{ result: res }]);
        } catch (e) {
          return Promise.reject(e);
        }
      }
    };
  }

  reset() {
    this.storageData = {};
    this.tabsList = [];
    this.messageListeners = [];
    this.connectListeners = [];
    this.installedListeners = [];
    this.contextMenuListeners = [];
    this.contextMenusCreated = [];
    this.tabUpdatedListeners = [];
    this.tabRemovedListeners = [];
    this.actionClickListeners = [];
  }
}

module.exports = { MockChrome };
