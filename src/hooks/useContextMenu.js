import { useState, useCallback } from 'react';

export function useContextMenu(wrapperRef) {
  const [menu, setMenu] = useState(null);

  const closeMenu = useCallback(() => setMenu(null), []);

  const onPaneContextMenu = useCallback((e) => {
    e.preventDefault();
    const bounds = wrapperRef.current.getBoundingClientRect();
    setMenu({ x: e.clientX - bounds.left, y: e.clientY - bounds.top, type: 'pane', flowX: e.clientX, flowY: e.clientY });
  }, [wrapperRef]);

  const onNodeContextMenu = useCallback((e, node) => {
    e.preventDefault();
    const bounds = wrapperRef.current.getBoundingClientRect();
    setMenu({ x: e.clientX - bounds.left, y: e.clientY - bounds.top, type: 'node', nodeId: node.id, nodeType: node.type });
  }, [wrapperRef]);

  return { menu, closeMenu, onPaneContextMenu, onNodeContextMenu };
}
