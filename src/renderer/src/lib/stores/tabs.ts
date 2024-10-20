import type { Tab } from "@shared/types";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const useTabsStore = create(persist<{
  tabs: Tab[];
  addTab: (tab: Tab) => void;
  removeTab: (id: string) => void;
}>((set, get) => ({
      tabs: [],
      addTab: tab => set({ tabs: get().tabs.concat(tab) }),
      removeTab: id => set({ tabs: get().tabs.filter(tab => tab.id !== id) }),
    }), {
      name: "tabs",
      storage: createJSONStorage(() => ({
        getItem: key => window.electron.ipcRenderer.invoke("get-storage", key),
        setItem: (key, value) => window.electron.ipcRenderer.invoke("set-storage", key, value),
        removeItem: () => {},
      })),
    }));
