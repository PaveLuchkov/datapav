import { useCallback } from 'react';
import { MarkerType } from 'reactflow';
import { uid } from '../../utils/uid';

export function useFunctionCallbacks(setNodes, setEdges, pushHistory) {
  // `existingInputId` (same-name match, resolved by the component) switches the
  // drop from "append input" to "REBIND": the input keeps its id — so output
  // links (fromInputId) survive — and just points at the new source; broken
  // state clears. The stale edge to the old source is replaced.
  const onFunctionInputDrop = useCallback((funcNodeId, { sourceNodeId, attrId, attrName, attrType, sourceNodeLabel }, existingInputId = null) => {
    pushHistory();
    const inputId = existingInputId || uid();
    const patch = { attrName, attrType: attrType || 'string', sourceNodeId, sourceNodeLabel: sourceNodeLabel || sourceNodeId, sourceAttrId: attrId, broken: false };
    setNodes((nds) => nds.map((n) =>
      n.id === funcNodeId
        ? {
            ...n,
            data: {
              ...n.data,
              inputs: existingInputId
                ? n.data.inputs.map((i) => i.id === existingInputId ? { ...i, ...patch } : i)
                : [...n.data.inputs, { id: inputId, ...patch }],
            },
          }
        : n
    ));
    setEdges((eds) => [...eds.filter((e) => e.targetHandle !== `${inputId}-target`), {
      id: `e-fn-${attrId}-${inputId}`,
      source: sourceNodeId, sourceHandle: `${attrId}-source`,
      target: funcNodeId, targetHandle: `${inputId}-target`,
      type: 'smoothstep',
      style: { stroke: '#10b981', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
    }]);
  }, [setNodes, setEdges, pushHistory]);

  const onDeleteFunctionInput = useCallback((funcNodeId, inputId) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === funcNodeId
        ? { ...n, data: { ...n.data, inputs: n.data.inputs.filter((i) => i.id !== inputId) } }
        : n
    ));
    setEdges((eds) => eds.filter((e) => e.targetHandle !== `${inputId}-target`));
  }, [setNodes, setEdges, pushHistory]);

  const onAddFunctionOutput = useCallback((funcNodeId) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === funcNodeId
        ? { ...n, data: { ...n.data, outputs: [...n.data.outputs, { id: uid(), name: 'output_col', type: 'string' }] } }
        : n
    ));
  }, [setNodes, pushHistory]);

  const onDeleteFunctionOutput = useCallback((funcNodeId, outputId) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === funcNodeId
        ? { ...n, data: { ...n.data, outputs: n.data.outputs.filter((o) => o.id !== outputId) } }
        : n
    ));
    setEdges((eds) => eds.filter((e) => !e.sourceHandle?.startsWith(outputId) && !e.targetHandle?.startsWith(outputId)));
  }, [setNodes, setEdges, pushHistory]);

  const onFunctionOutputChange = useCallback((funcNodeId, outputId, name) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === funcNodeId
        ? { ...n, data: { ...n.data, outputs: n.data.outputs.map((o) => o.id === outputId ? { ...o, name } : o) } }
        : n
    ));
  }, [setNodes, pushHistory]);

  const onFunctionOutputTypeChange = useCallback((funcNodeId, outputId, type) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === funcNodeId
        ? { ...n, data: { ...n.data, outputs: n.data.outputs.map((o) => o.id === outputId ? { ...o, type } : o) } }
        : n
    ));
  }, [setNodes, pushHistory]);

  // Link an output to an input column so tracing passes through the function.
  // When fromInputId is set, name and type auto-sync to the input's values.
  const onFunctionOutputLinkChange = useCallback((funcNodeId, outputId, fromInputId) => {
    pushHistory();
    setNodes((nds) => nds.map((n) => {
      if (n.id !== funcNodeId) return n;
      const inputs = n.data.inputs || [];
      return {
        ...n,
        data: {
          ...n.data,
          outputs: n.data.outputs.map((o) => {
            if (o.id !== outputId) return o;
            if (!fromInputId) return { ...o, fromInputId: null };
            const inp = inputs.find((i) => i.id === fromInputId);
            if (!inp) return { ...o, fromInputId };
            return { ...o, fromInputId, name: inp.attrName, type: inp.attrType || 'string' };
          }),
        },
      };
    }));
  }, [setNodes, pushHistory]);

  const onFunctionExtendModeChange = useCallback((funcNodeId, extendMode) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === funcNodeId ? { ...n, data: { ...n.data, extendMode } } : n
    ));
  }, [setNodes, pushHistory]);

  return {
    onFunctionInputDrop, onDeleteFunctionInput,
    onAddFunctionOutput, onDeleteFunctionOutput, onFunctionOutputChange,
    onFunctionOutputTypeChange, onFunctionOutputLinkChange, onFunctionExtendModeChange,
  };
}
