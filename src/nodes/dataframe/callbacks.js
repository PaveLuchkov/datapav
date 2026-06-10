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

  // `existingAttrId` (resolved by the component from a same-name match) switches
  // the drop from "copy column" to "RECONNECT": heal the existing attribute,
  // refresh its type, and wire the lineage edge to it — no duplicate is created.
  const onAttributeDrop = useCallback((targetNodeId, { sourceNodeId, attrId, attrName, attrType }, existingAttrId = null) => {
    pushHistory();
    const newAttr = existingAttrId ? null : makeAttr(attrName, attrType || 'string');
    const targetAttrId = existingAttrId || newAttr.id;
    setNodes((nds) => nds.map((n) => {
      if (n.id !== targetNodeId) return n;
      const attributes = existingAttrId
        ? n.data.attributes.map((a) => a.id === existingAttrId ? { ...a, broken: false, type: attrType || a.type } : a)
        : [...n.data.attributes, newAttr];
      return { ...n, data: { ...n.data, attributes } };
    }));
    setEdges((eds) => {
      if (eds.some((e) => e.sourceHandle === `${attrId}-source` && e.targetHandle === `${targetAttrId}-target`)) return eds;
      return [...eds, {
        id: `e-${attrId}-${targetAttrId}`,
        source: sourceNodeId, sourceHandle: `${attrId}-source`,
        target: targetNodeId, targetHandle: `${targetAttrId}-target`,
        type: 'columnEdge',
        style: { stroke: '#60a5fa', strokeWidth: 1.5 },
      }];
    });
  }, [setNodes, setEdges, pushHistory]);

  return {
    onLabelChange, onAttributeChange, onAttributeTypeChange,
    onAddAttribute, onDeleteAttribute, onReorderAttributes, onAttributeDrop,
  };
}
