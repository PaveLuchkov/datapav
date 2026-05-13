import { useCallback } from 'react';

export function useFilterCallbacks(setNodes, pushHistory) {
  const onFilterConditionChange = useCallback((nodeId, condition) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, condition } } : n
    ));
  }, [setNodes, pushHistory]);

  return { onFilterConditionChange };
}
