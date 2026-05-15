import { uid } from '../../utils/uid';

const colors = {
  bg:          '#052e16',
  header:      '#14532d',
  border:      '#166534',
  handleFill:  '#10b981',
  handleBorder:'#052e16',
};

const functionConfig = {
  type: 'functionNode',
  colors,
  minimapColor: '#052e16',
  dagreWidth: 380,
  dagreHeight: (node) => {
    const rows = Math.max(node.data.inputs?.length || 0, node.data.outputs?.length || 0, 3);
    return 60 + rows * 24;
  },
  make: (x, y) => ({
    id: uid(),
    type: 'functionNode',
    position: { x, y },
    data: { label: 'my_function', inputs: [], outputs: [], code: '', stage: null },
  }),
  menu: { label: 'Function', icon: 'ƒ', btnClass: 'bg-emerald-800 hover:bg-emerald-700 text-emerald-100 font-mono' },
  connections: [],
};

export default functionConfig;
