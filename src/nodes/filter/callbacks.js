import { useCallback } from 'react';
import { uid } from '../../utils/uid';

export function useFilterCallbacks(setNodes, pushHistory) {
  const onAddFilterCondition = useCallback((nodeId, op) => {
    pushHistory();
    setNodes((nds) => nds.map((n) => {
      if (n.id !== nodeId) return n;
      const existing = n.data.conditions || [{ id: uid(), op: 'WHERE', expr: n.data.condition || '' }];
      return { ...n, data: { ...n.data, conditions: [...existing, { id: uid(), op, expr: '' }] } };
    }));
  }, [setNodes, pushHistory]);

  const onDeleteFilterCondition = useCallback((nodeId, condId) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, conditions: (n.data.conditions || []).filter((c) => c.id !== condId) } }
        : n
    ));
  }, [setNodes, pushHistory]);

  const onUpdateFilterExpr = useCallback((nodeId, condId, expr) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, conditions: (n.data.conditions || []).map((c) => c.id === condId ? { ...c, expr } : c) } }
        : n
    ));
  }, [setNodes, pushHistory]);

  const onToggleFilterOp = useCallback((nodeId, condId) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, conditions: (n.data.conditions || []).map((c) => c.id === condId ? { ...c, op: c.op === 'AND' ? 'OR' : 'AND' } : c) } }
        : n
    ));
  }, [setNodes, pushHistory]);

  return { onAddFilterCondition, onDeleteFilterCondition, onUpdateFilterExpr, onToggleFilterOp };
}
