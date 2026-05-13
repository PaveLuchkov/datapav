export const DRAG_TYPE = 'application/lineage-attr';
export const STORAGE_KEY = 'lineage-editor-state';

export const JOIN_TYPES = ['inner', 'left', 'right', 'outer'];

export const JOIN_ACTIVE_STYLES = {
  inner: { background: '#1d4ed8', color: '#fff' },
  left:  { background: '#6d28d9', color: '#fff' },
  right: { background: '#be185d', color: '#fff' },
  outer: { background: '#b45309', color: '#fff' },
};

export const COLORS = {
  dataframe: {
    bg:          '#0f2744',
    header:      '#1a3a5c',
    border:      '#1e4d8c',
    handleFill:  '#0d9488',
    handleBorder:'#042f2e',
  },
  function: {
    bg:          '#052e16',
    header:      '#14532d',
    border:      '#166534',
    handleFill:  '#10b981',
    handleBorder:'#052e16',
  },
  merge: {
    bg:          '#160d2e',
    header:      '#2e1065',
    border:      '#4c1d95',
    handleLeft:  '#7c3aed',
    handleRight: '#9333ea',
    handleBorder:'#2e1065',
  },
};

export const SIZES = {
  dataframeMinWidth: 200,
  mergeMinWidth:     360,
  functionMinWidth:  360,
  attrRowMinHeight:  28,
  fnRowMinHeight:    24,
  fnBodyMinHeight:   72,
  mergeBodyMinHeight:80,
};
