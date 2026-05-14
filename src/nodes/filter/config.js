import { uid } from '../../utils/uid';

const colors = {
  bg:          '#1c0902',
  header:      '#431407',
  border:      '#9a3412',
  handleFill:  '#fb923c',
  handleBorder:'#1c0902',
};

const filterConfig = {
  type: 'filterNode',
  colors,
  minimapColor: '#431407',
  dagreWidth: 300,
  dagreHeight: (node) => {
    const condCount = Math.max(1, node.data.conditions?.length || 1);
    return 52 + condCount * 34 + 28;
  },
  make: (x, y) => ({
    id: uid(),
    type: 'filterNode',
    position: { x, y },
    data: { label: 'my_filter', conditions: [{ id: uid(), op: 'WHERE', expr: '' }] },
  }),
  menu: { label: 'Filter', icon: 'σ', btnClass: 'bg-orange-900 hover:bg-orange-800 text-orange-100 font-mono' },
  connections: [],
};

export default filterConfig;
