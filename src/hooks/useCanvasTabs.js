import { useState, useEffect, useCallback } from 'react';
import { STORAGE_KEY, TABS_KEY, ACTIVE_TAB_KEY, canvasKey } from '../constants';
import { uid } from '../utils/uid';

function readTabCanvas(tabId) {
  try {
    const raw = localStorage.getItem(canvasKey(tabId));
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function initTabSystem() {
  try {
    const rawTabs = localStorage.getItem(TABS_KEY);
    if (rawTabs) {
      const tabs = JSON.parse(rawTabs);
      if (tabs.length) {
        const savedActive = localStorage.getItem(ACTIVE_TAB_KEY);
        const activeId = tabs.find((t) => t.id === savedActive) ? savedActive : tabs[0].id;
        return { tabs, activeId };
      }
    }
  } catch {}

  // First run — create default tab, migrate old STORAGE_KEY data if present
  const id = `t${Date.now()}`;
  const oldData = localStorage.getItem(STORAGE_KEY);
  if (oldData) localStorage.setItem(canvasKey(id), oldData);
  const tabs = [{ id, name: 'Canvas 1' }];
  localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
  localStorage.setItem(ACTIVE_TAB_KEY, id);
  return { tabs, activeId: id };
}

export function useCanvasTabs({ nodes, edges, restoreState }) {
  const [{ tabs, activeId }, setState] = useState(initTabSystem);

  // ── Auto-save active canvas on every change ─────────────────────────────
  useEffect(() => {
    localStorage.setItem(canvasKey(activeId), JSON.stringify({ nodes, edges }));
  }, [nodes, edges, activeId]);

  // ── Persist tab list ─────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
  }, [tabs]);

  // ── Switch ───────────────────────────────────────────────────────────────
  const switchTab = useCallback((newId) => {
    if (newId === activeId) return;
    const canvas = readTabCanvas(newId);
    localStorage.setItem(ACTIVE_TAB_KEY, newId);
    setState((s) => ({ ...s, activeId: newId }));
    restoreState(canvas?.nodes ?? [], canvas?.edges ?? []);
  }, [activeId, restoreState]);

  // ── Add ──────────────────────────────────────────────────────────────────
  const addTab = useCallback(() => {
    const id = uid();
    setState((s) => {
      const newTabs = [...s.tabs, { id, name: `Canvas ${s.tabs.length + 1}` }];
      localStorage.setItem(ACTIVE_TAB_KEY, id);
      return { tabs: newTabs, activeId: id };
    });
    restoreState([], []);
  }, [restoreState]);

  // ── Close ────────────────────────────────────────────────────────────────
  const closeTab = useCallback((tabId) => {
    setState((s) => {
      if (s.tabs.length === 1) return s;
      const idx = s.tabs.findIndex((t) => t.id === tabId);
      const newTabs = s.tabs.filter((t) => t.id !== tabId);
      localStorage.removeItem(canvasKey(tabId));

      if (tabId !== s.activeId) return { tabs: newTabs, activeId: s.activeId };

      const newActive = newTabs[Math.min(idx, newTabs.length - 1)];
      const canvas = readTabCanvas(newActive.id);
      localStorage.setItem(ACTIVE_TAB_KEY, newActive.id);
      // restoreState must be called outside setState; schedule via timeout
      setTimeout(() => restoreState(canvas?.nodes ?? [], canvas?.edges ?? []), 0);
      return { tabs: newTabs, activeId: newActive.id };
    });
  }, [restoreState]);

  // ── Rename ───────────────────────────────────────────────────────────────
  const renameTab = useCallback((tabId, name) => {
    setState((s) => ({ ...s, tabs: s.tabs.map((t) => t.id === tabId ? { ...t, name } : t) }));
  }, []);

  return { tabs, activeTabId: activeId, switchTab, addTab, closeTab, renameTab };
}
