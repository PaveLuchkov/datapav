import { useCallback } from 'react';
import { getNodesBounds, getViewportForBounds } from 'reactflow';
import { toPng } from 'html-to-image';
import { STORAGE_KEY } from '../constants';

export function useLineagePersistence({ nodes, edges, restoreState, showToast }) {
  const saveState = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }));
    showToast('Saved!');
  }, [nodes, edges, showToast]);

  const loadState = useCallback(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) { showToast('Nothing saved yet'); return; }
    try {
      const { nodes: sn, edges: se } = JSON.parse(saved);
      restoreState(sn, se);
      showToast('Loaded!');
    } catch { showToast('Failed to load'); }
  }, [restoreState, showToast]);

  const exportPng = useCallback(() => {
    const nodesBounds = getNodesBounds(nodes);
    const pad = 40;
    const width = nodesBounds.width + pad * 2;
    const height = nodesBounds.height + pad * 2;
    const viewport = getViewportForBounds(nodesBounds, width, height, 0.5, 2, pad);
    const flowEl = document.querySelector('.react-flow__viewport');
    if (!flowEl) return;
    toPng(flowEl, {
      backgroundColor: '#0f172a', width, height,
      style: { width, height, transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` },
    }).then((dataUrl) => {
      const a = document.createElement('a');
      a.href = dataUrl; a.download = 'lineage.png'; a.click();
    });
  }, [nodes]);

  const saveToFile = useCallback(() => {
    const json = JSON.stringify({ nodes, edges }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lineage-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges]);

  const loadFromFile = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const { nodes: sn, edges: se } = JSON.parse(ev.target.result);
          restoreState(sn, se);
          showToast(`Loaded ${file.name}`);
        } catch {
          showToast('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [restoreState, showToast]);

  return { saveState, loadState, exportPng, saveToFile, loadFromFile };
}
