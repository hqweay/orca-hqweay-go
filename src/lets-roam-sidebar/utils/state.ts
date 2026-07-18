import { proxy } from "valtio";

export interface StackedBlock {
  id: number;
  collapsed?: boolean;
}

export interface Tab {
  id: string;
  name: string;
  stackedBlocks: StackedBlock[];
}

let tabIdCounter = 0;
const nextTabId = () => `tab-${Date.now()}-${++tabIdCounter}`;

export const roamSidebarState = proxy({
  tabs: [] as Tab[],
  activeTabIndex: 0,
});

export const activeTab = (): Tab | null => {
  const { tabs, activeTabIndex } = roamSidebarState;
  return tabs[activeTabIndex] || null;
};

export const stackedBlocks = (): StackedBlock[] => {
  return activeTab()?.stackedBlocks || [];
};

// --- Tab operations ---

export const createTab = (name: string): Tab => {
  const tab: Tab = { id: nextTabId(), name, stackedBlocks: [] };
  roamSidebarState.tabs.push(tab);
  roamSidebarState.activeTabIndex = roamSidebarState.tabs.length - 1;
  return tab;
};

export const deleteTab = (index: number) => {
  const { tabs } = roamSidebarState;
  if (tabs.length <= 1) {
    tabs[0] = { id: nextTabId(), name: "Tab 1", stackedBlocks: [] };
    roamSidebarState.activeTabIndex = 0;
    return;
  }
  tabs.splice(index, 1);
  if (roamSidebarState.activeTabIndex >= tabs.length) {
    roamSidebarState.activeTabIndex = tabs.length - 1;
  }
};

export const renameTab = (index: number, name: string) => {
  if (roamSidebarState.tabs[index]) {
    roamSidebarState.tabs[index].name = name;
  }
};

export const duplicateTab = (index: number) => {
  const source = roamSidebarState.tabs[index];
  if (!source) return;
  const tab: Tab = {
    id: nextTabId(),
    name: `${source.name} (copy)`,
    stackedBlocks: JSON.parse(JSON.stringify(source.stackedBlocks)),
  };
  roamSidebarState.tabs.splice(index + 1, 0, tab);
  roamSidebarState.activeTabIndex = index + 1;
};

export const setActiveTab = (index: number) => {
  roamSidebarState.activeTabIndex = index;
};

export const moveTab = (fromIndex: number, toIndex: number) => {
  const { tabs } = roamSidebarState;
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
  const [moved] = tabs.splice(fromIndex, 1);
  tabs.splice(toIndex, 0, moved);
  roamSidebarState.activeTabIndex = toIndex;
};

// --- Block operations (operate on active tab) ---

export const addStackedBlock = (blockId: number) => {
  const tab = activeTab();
  if (!tab) return;
  const existingIdx = tab.stackedBlocks.findIndex(b => b.id === blockId);
  if (existingIdx >= 0) {
    tab.stackedBlocks.splice(existingIdx, 1);
  }
  tab.stackedBlocks.unshift({ id: blockId, collapsed: false });
};

export const removeStackedBlock = (blockId: number) => {
  const tab = activeTab();
  if (!tab) return;
  const existingIdx = tab.stackedBlocks.findIndex(b => b.id === blockId);
  if (existingIdx >= 0) {
    tab.stackedBlocks.splice(existingIdx, 1);
  }
};

export const toggleBlockCollapse = (blockId: number) => {
  const tab = activeTab();
  if (!tab) return;
  const block = tab.stackedBlocks.find(b => b.id === blockId);
  if (block) {
    block.collapsed = !block.collapsed;
  }
};

export const collapseAll = () => {
  const tab = activeTab();
  if (!tab) return;
  tab.stackedBlocks.forEach(b => (b.collapsed = true));
};

export const expandAll = () => {
  const tab = activeTab();
  if (!tab) return;
  tab.stackedBlocks.forEach(b => (b.collapsed = false));
};

export const moveStackedBlock = (blockId: number, toIndex: number) => {
  const tab = activeTab();
  if (!tab) return;
  const fromIndex = tab.stackedBlocks.findIndex(b => b.id === blockId);
  if (fromIndex < 0 || fromIndex === toIndex) return;

  const adjustedToIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
  const [moved] = tab.stackedBlocks.splice(fromIndex, 1);
  tab.stackedBlocks.splice(adjustedToIndex, 0, moved);
};
