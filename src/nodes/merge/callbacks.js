import { useCallback } from 'react';

export function useMergeCallbacks(setNodes, pushHistory) {
  const onJoinTypeChange = useCallback((nodeId, joinType) => {
    pushHistory();
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, joinType } } : n));
  }, [setNodes, pushHistory]);

  const onAddKey = useCallback((nodeId) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, keyPairs: [...(n.data.keyPairs || []), { left: '', right: '' }] } }
        : n
    ));
  }, [setNodes, pushHistory]);

  const onRemoveKey = useCallback((nodeId, index) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, keyPairs: (n.data.keyPairs || []).filter((_, i) => i !== index) } }
        : n
    ));
  }, [setNodes, pushHistory]);

  const onUpdateKey = useCallback((nodeId, index, side, value) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, keyPairs: (n.data.keyPairs || []).map((p, i) => i === index ? { ...p, [side]: value } : p) } }
        : n
    ));
  }, [setNodes, pushHistory]);

  return { onJoinTypeChange, onAddKey, onRemoveKey, onUpdateKey };
}
