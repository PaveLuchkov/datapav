import { useCallback } from 'react';
import { uid } from '../../utils/uid';
import { MarkerType } from 'reactflow';

export function useGroupByCallbacks(setNodes, setEdges, pushHistory) {
  // `existingInputId` (same-name match, resolved by the component) → REBIND in
  // place instead of appending: the input keeps its id, so group-by keys and
  // aggregations referencing it survive; broken state clears; the stale edge
  // to the old source is replaced.
  const onGroupByInputDrop = useCallback((nodeId, { sourceNodeId, attrId, attrName, attrType, sourceNodeLabel }, existingInputId = null) => {
    pushHistory();
    const inputId = existingInputId || uid();
    const patch = { attrName, attrType: attrType || 'string', sourceNodeId, sourceNodeLabel: sourceNodeLabel || sourceNodeId, sourceAttrId: attrId, broken: false };
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? {
            ...n,
            data: {
              ...n.data,
              inputs: existingInputId
                ? (n.data.inputs || []).map((i) => i.id === existingInputId ? { ...i, ...patch } : i)
                : [...(n.data.inputs || []), { id: inputId, ...patch }],
            },
          }
        : n
    ));
    setEdges((eds) => [...eds.filter((e) => e.targetHandle !== `${inputId}-target`), {
      id: `e-gb-${attrId}-${inputId}`,
      source: sourceNodeId, sourceHandle: `${attrId}-source`,
      target: nodeId,       targetHandle: `${inputId}-target`,
      type: 'smoothstep',
      style: { stroke: '#0ea5e9', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#0ea5e9' },
    }]);
  }, [setNodes, setEdges, pushHistory]);

  const onDeleteGroupByInput = useCallback((nodeId, inputId) => {
    pushHistory();
    setNodes((nds) => nds.map((n) => {
      if (n.id !== nodeId) return n;
      return {
        ...n,
        data: {
          ...n.data,
          inputs: n.data.inputs.filter((i) => i.id !== inputId),
          groupByInputIds: (n.data.groupByInputIds || []).filter((id) => id !== inputId),
          aggregations: (n.data.aggregations || []).filter((a) => a.inputId !== inputId),
        },
      };
    }));
    setEdges((eds) => eds.filter((e) => e.targetHandle !== `${inputId}-target`));
  }, [setNodes, setEdges, pushHistory]);

  const onToggleGroupByKey = useCallback((nodeId, inputId) => {
    pushHistory();
    setNodes((nds) => nds.map((n) => {
      if (n.id !== nodeId) return n;
      const keys = n.data.groupByInputIds || [];
      const next = keys.includes(inputId) ? keys.filter((id) => id !== inputId) : [...keys, inputId];
      return { ...n, data: { ...n.data, groupByInputIds: next } };
    }));
  }, [setNodes, pushHistory]);

  const onAddGroupByAgg = useCallback((nodeId) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, aggregations: [...(n.data.aggregations || []), { id: uid(), inputId: '', func: 'sum', outputName: '' }] } }
        : n
    ));
  }, [setNodes, pushHistory]);

  const onDeleteGroupByAgg = useCallback((nodeId, aggId) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, aggregations: n.data.aggregations.filter((a) => a.id !== aggId) } }
        : n
    ));
    setEdges((eds) => eds.filter((e) => !e.sourceHandle?.startsWith(`aggout-${aggId}`)));
  }, [setNodes, setEdges, pushHistory]);

  const onUpdateGroupByAgg = useCallback((nodeId, aggId, field, value) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, aggregations: n.data.aggregations.map((a) => a.id === aggId ? { ...a, [field]: value } : a) } }
        : n
    ));
  }, [setNodes, pushHistory]);

  return {
    onGroupByInputDrop, onDeleteGroupByInput, onToggleGroupByKey,
    onAddGroupByAgg, onDeleteGroupByAgg, onUpdateGroupByAgg,
  };
}
