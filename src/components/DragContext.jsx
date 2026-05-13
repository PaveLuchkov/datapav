import { createContext, useContext, useRef } from 'react';

const DragContext = createContext(null);

export function DragProvider({ children }) {
  const dragRef = useRef(null);
  return <DragContext.Provider value={dragRef}>{children}</DragContext.Provider>;
}

export function useDrag() {
  return useContext(DragContext);
}
