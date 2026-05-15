import { useCallback } from 'react';
import { uid } from '../../utils/uid';

const makeAttr = (name, type = 'string') => ({ id: uid(), name, type });

export function useDataFrameCallbacks(setNodes, setEdges, pushHistory) {
  const onLabelChange = useCallback((nodeId, label) => {
    pushHistory();
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, label } } : n));
  }, [setNodes, pushHistory]);

  const onAttributeChange = useCallback((nodeId, attrId, name) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, attributes: n.data.attributes.map((a) => a.id === attrId ? { ...a, name } : a) } }
        : n
    ));
  }, [setNodes, pushHistory]);

  const onAttributeTypeChange = useCallback((nodeId, attrId, type) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, attributes: n.data.attributes.map((a) => a.id === attrId ? { ...a, type } : a) } }
        : n
    ));
  }, [setNodes, pushHistory]);

  const onAddAttribute = useCallback((nodeId) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, attributes: [...n.data.attributes, makeAttr('column')] } }
        : n
    ));
  }, [setNodes, pushHistory]);

  const onDeleteAttribute = useCallback((nodeId, attrId) => {
    pushHistory();
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, attributes: n.data.attributes.filter((a) => a.id !== attrId) } }
        : n
    ));
    setEdges((eds) =>
      eds.filter((e) => !e.sourceHandle?.startsWith(attrId) && !e.targetHandle?.startsWith(attrId))
    );
  }, [setNodes, setEdges, pushHistory]);

  const onReorderAttributes = useCallback((nodeId, fromIndex, toIndex) => {
    pushHistory();
    setNodes((nds) => nds.map((n) => {
      if (n.id !== nodeId) return n;
      const attrs = [...n.data.attributes];
      const [moved] = attrs.splice(fromIndex, 1);
      attrs.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, moved);
      return { ...n, data: { ...n.data, attributes: attrs } };
    }));
  }, [setNodes, pushHistory]);

  const onAttributeDrop = useCallback((targetNodeId, { sourceNodeId, attrId, attrName, attrType }) => {
    pushHistory();
    const newAttr = makeAttr(attrName, attrType || 'string');
    setNodes((nds) => nds.map((n) =>
      n.id === targetNodeId
        ? { ...n, data: { ...n.data, attributes: [...n.data.attributes, newAttr] } }
        : n
    ));
    setEdges((eds) => [...eds, {
      id: `e-${attrId}-${newAttr.id}`,
      source: sourceNodeId, sourceHandle: `${attrId}-source`,
      target: targetNodeId, targetHandle: `${newAttr.id}-target`,
      type: 'columnEdge',
      style: { stroke: '#60a5fa', strokeWidth: 1.5 },
    }]);
  }, [setNodes, setEdges, pushHistory]);

  return {
    onLabelChange, onAttributeChange, onAttributeTypeChange,
    onAddAttribute, onDeleteAttribute, onReorderAttributes, onAttributeDrop,
  };
}
