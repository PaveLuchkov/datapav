import { useCallback } from 'react';

export function useCommentCallbacks(setNodes, pushHistory) {
  const onCommentTextChange = useCallback((nodeId, text) => {
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, text } } : n
    ));
  }, [setNodes]);

  const onCommentColorChange = useCallback((nodeId, color) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, color } } : n
    ));
  }, [setNodes, pushHistory]);

  return { onCommentTextChange, onCommentColorChange };
}
