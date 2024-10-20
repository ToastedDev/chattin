import { create } from "zustand";

interface Tab {
  id: string;
  title: string;
  channelId?: string;
  videoId?: string;
}

export const useTabsStore = create<{
  tabs: Tab[];
  addTab: (tab: Tab) => void;
  removeTab: (id: string) => void;
}>(set => ({
      tabs: [],
      addTab: tab => set(state => ({ tabs: [...state.tabs, tab] })),
      removeTab: id => set(state => ({ tabs: state.tabs.filter(tab => tab.id !== id) })),
    }));
