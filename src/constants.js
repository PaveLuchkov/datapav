export const DRAG_TYPE  = 'application/lineage-attr';
export const STORAGE_KEY = 'lineage-editor-state';

export const TABS_KEY       = 'lineage-editor-tabs';
export const ACTIVE_TAB_KEY = 'lineage-editor-active';
export const canvasKey      = (id) => `lineage-editor-canvas-${id}`;
export const getActiveCanvasKey = () => {
  try {
    const id = localStorage.getItem(ACTIVE_TAB_KEY);
    if (id) return canvasKey(id);
  } catch {}
  return STORAGE_KEY;
};

export const JOIN_TYPES = ['inner', 'left', 'right', 'outer'];

export const JOIN_ACTIVE_STYLES = {
  inner: { background: '#1d4ed8', color: '#fff' },
  left:  { background: '#6d28d9', color: '#fff' },
  right: { background: '#be185d', color: '#fff' },
  outer: { background: '#b45309', color: '#fff' },
};

export const ATTR_TYPES = ['string', 'int', 'float', 'date', 'bool'];
export const ATTR_TYPE_META = {
  string: { abbr: 'str',  color: '#60a5fa', bg: 'rgba(30,58,138,0.5)'  },
  int:    { abbr: 'int',  color: '#4ade80', bg: 'rgba(20,83,45,0.5)'   },
  float:  { abbr: 'flt',  color: '#2dd4bf', bg: 'rgba(19,78,74,0.5)'   },
  date:   { abbr: 'dat',  color: '#fb923c', bg: 'rgba(120,53,15,0.5)'  },
  bool:   { abbr: 'bool', color: '#c084fc', bg: 'rgba(46,16,101,0.5)'  },
};
