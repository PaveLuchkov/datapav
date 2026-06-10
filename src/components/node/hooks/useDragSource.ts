import { useCallback } from 'react';
import { useStoreApi } from 'reactflow';
import { useDrag } from '../../DragContext';
import { DRAG_TYPE } from '../../../constants';

// Starting a column drag (to copy a column / wire lineage) was copy-pasted as
// onAttrDragStart / onOutputDragStart across DataFrame, GroupBy and Function.

export interface DragPayload {
  sourceNodeId: string;
  attrId: string;
  attrName: string;
  attrType: string;
  sourceNodeLabel?: string;
}

export function useDragSource(nodeId: string, label?: string) {
  const dragRef = useDrag();
  const store = useStoreApi();

  const startDrag = useCallback(
    (e: React.DragEvent, item: { attrId: string; attrName: string; attrType: string }) => {
      e.stopPropagation();
      // If mousedown landed on a React Flow Handle (Port), it started connection-drawing
      // mode. Cancel it immediately so the HTML5 drag doesn't leave a ghost connection
      // line stuck to the cursor after the drop.
      store.getState().cancelConnection();
      const drag: DragPayload = { sourceNodeId: nodeId, sourceNodeLabel: label, ...item };
      dragRef.current = drag;
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(drag));
    },
    [nodeId, label, dragRef, store]
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, [dragRef]);

  return { startDrag, endDrag };
}
