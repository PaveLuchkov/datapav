import { useCallback } from 'react';
import { MarkerType } from 'reactflow';
import { uid } from '../../utils/uid';

export function useFunctionCallbacks(setNodes, setEdges, pushHistory) {
  const onFunctionInputDrop = useCallback((funcNodeId, { sourceNodeId, attrId, attrName, attrType, sourceNodeLabel }) => {
    pushHistory();
    const newInput = { id: uid(), attrName, attrType: attrType || 'string', sourceNodeId, sourceNodeLabel: sourceNodeLabel || sourceNodeId, sourceAttrId: attrId };
    setNodes((nds) => nds.map((n) =>
      n.id === funcNodeId
        ? { ...n, data: { ...n.data, inputs: [...n.data.inputs, newInput] } }
        : n
    ));
    setEdges((eds) => [...eds, {
      id: `e-fn-${attrId}-${newInput.id}`,
      source: sourceNodeId, sourceHandle: `${attrId}-source`,
      target: funcNodeId, targetHandle: `${newInput.id}-target`,
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

  return {
    onFunctionInputDrop, onDeleteFunctionInput,
    onAddFunctionOutput, onDeleteFunctionOutput, onFunctionOutputChange,
    onFunctionOutputTypeChange, onFunctionOutputLinkChange,
  };
}
