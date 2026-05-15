import { useCallback } from 'react';
import { uid } from '../../utils/uid';

export function useRenameCallbacks(setNodes, pushHistory) {
  const onAddMapping = useCallback((nodeId) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, mappings: [...(n.data.mappings || []), { id: uid(), from: '', to: '' }] } }
        : n
    ));
  }, [setNodes, pushHistory]);

  const onDeleteMapping = useCallback((nodeId, mapId) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, mappings: n.data.mappings.filter((m) => m.id !== mapId) } }
        : n
    ));
  }, [setNodes, pushHistory]);

  const onUpdateMapping = useCallback((nodeId, mapId, field, value) => {
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, mappings: n.data.mappings.map((m) => m.id === mapId ? { ...m, [field]: value } : m) } }
        : n
    ));
  }, [setNodes]);

  return { onAddMapping, onDeleteMapping, onUpdateMapping };
}
