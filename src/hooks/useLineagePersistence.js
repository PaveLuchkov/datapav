import { useCallback } from 'react';
import { getNodesBounds, getViewportForBounds } from 'reactflow';
import { toPng } from 'html-to-image';
import { deflate, inflate } from 'pako';
import { getActiveCanvasKey } from '../constants';

// ── URL encoding helpers ────────────────────────────────────────────────────
// Compress JSON with deflate, encode as URL-safe base64.
// A typical 30-node graph compresses from ~40KB JSON → ~3–5KB URL fragment.

function encodeState(nodes, edges) {
  const json = JSON.stringify({ nodes, edges });
  const bytes = deflate(json, { level: 6 });
  // Convert Uint8Array → binary string → base64, then make URL-safe
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeState(hash) {
  // Restore URL-safe base64 → standard base64 → binary → Uint8Array → inflate
  const b64 = hash.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return JSON.parse(inflate(bytes, { to: 'string' }));
}

export function useLineagePersistence({ nodes, edges, restoreState, showToast }) {
  const saveState = useCallback(() => {
    localStorage.setItem(getActiveCanvasKey(), JSON.stringify({ nodes, edges }));
    showToast('Saved!');
  }, [nodes, edges, showToast]);

  const loadState = useCallback(() => {
    const saved = localStorage.getItem(getActiveCanvasKey());
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
    // padding=0 because pixel padding is already included in width/height above
    const viewport = getViewportForBounds(nodesBounds, width, height, 0.5, 2, 0);
    const flowEl = document.querySelector('.react-flow__viewport');
    if (!flowEl) return;

    // Attribute edges have no inline stroke (rely on CSS class), html-to-image doesn't
    // transfer CSS class styles to cloned SVG — set inline before capture, restore after
    const edgePaths = Array.from(flowEl.querySelectorAll('.react-flow__edge-path'));
    const savedStrokes = edgePaths.map((el) => ({ stroke: el.style.stroke, width: el.style.strokeWidth }));
    edgePaths.forEach((el) => {
      if (!el.style.stroke) el.style.stroke = '#60a5fa';
      if (!el.style.strokeWidth) el.style.strokeWidth = '2';
    });

    toPng(flowEl, {
      backgroundColor: '#0f172a', width, height, pixelRatio: 3,
      style: { width, height, transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` },
    }).then((dataUrl) => {
      edgePaths.forEach((el, i) => { el.style.stroke = savedStrokes[i].stroke; el.style.strokeWidth = savedStrokes[i].width; });
      const a = document.createElement('a');
      a.href = dataUrl; a.download = 'lineage.png'; a.click();
    }).catch(() => {
      edgePaths.forEach((el, i) => { el.style.stroke = savedStrokes[i].stroke; el.style.strokeWidth = savedStrokes[i].width; });
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

  // ── Clipboard ─────────────────────────────────────────────────────────────

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify({ nodes, edges }, null, 2));
      showToast('Copied to clipboard!');
    } catch {
      showToast('Clipboard access denied');
    }
  }, [nodes, edges, showToast]);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const { nodes: sn, edges: se } = JSON.parse(text);
      restoreState(sn, se);
      showToast('Pasted from clipboard!');
    } catch {
      showToast('Clipboard is empty or not valid canvas JSON');
    }
  }, [restoreState, showToast]);

  // ── URL sharing ───────────────────────────────────────────────────────────

  const copyShareUrl = useCallback(() => {
    try {
      const hash = encodeState(nodes, edges);
      const url = `${window.location.origin}${window.location.pathname}#${hash}`;
      navigator.clipboard.writeText(url).then(() => {
        showToast('Share link copied!');
      }).catch(() => {
        showToast('Clipboard access denied');
      });
    } catch {
      showToast('Failed to encode canvas');
    }
  }, [nodes, edges, showToast]);

  // Call once on mount from App.jsx to restore from URL hash if present.
  const loadFromUrlHash = useCallback(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return false;
    try {
      const { nodes: sn, edges: se } = decodeState(hash);
      restoreState(sn, se);
      // Clean the hash so refreshing doesn't re-import
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      showToast('Canvas loaded from shared link!');
      return true;
    } catch {
      showToast('Invalid share link');
      return false;
    }
  }, [restoreState, showToast]);

  return {
    saveState, loadState, exportPng, saveToFile, loadFromFile,
    copyToClipboard, pasteFromClipboard, copyShareUrl, loadFromUrlHash,
  };
}
