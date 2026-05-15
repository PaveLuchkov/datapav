import { useCallback } from 'react';
import { uid } from '../../utils/uid';

export function useTransformCallbacks(setNodes, pushHistory) {
  const onAddTransformOp = useCallback((nodeId) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, ops: [...(n.data.ops || []), { id: uid(), type: 'drop_duplicates', args: {} }] } }
        : n
    ));
  }, [setNodes, pushHistory]);

  const onDeleteTransformOp = useCallback((nodeId, opId) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, ops: n.data.ops.filter((o) => o.id !== opId) } }
        : n
    ));
  }, [setNodes, pushHistory]);

  const onUpdateTransformOp = useCallback((nodeId, opId, field, value) => {
    setNodes((nds) => nds.map((n) => {
      if (n.id !== nodeId) return n;
      return {
        ...n, data: {
          ...n.data,
          ops: n.data.ops.map((o) => {
            if (o.id !== opId) return o;
            if (field === 'type') return { ...o, type: value, args: {} };
            return { ...o, args: { ...o.args, [field]: value } };
          }),
        },
      };
    }));
  }, [setNodes]);

  return { onAddTransformOp, onDeleteTransformOp, onUpdateTransformOp };
}
