import { uid } from '../../utils/uid';

export const AGG_FUNCTIONS = ['sum', 'mean', 'count', 'min', 'max', 'first', 'last'];

const colors = {
  bg:          '#031d2e',
  header:      '#0c3148',
  border:      '#164e63',
  handleFill:  '#0ea5e9',
  handleBorder:'#031d2e',
};

const groupByConfig = {
  type: 'groupByNode',
  colors,
  minimapColor: '#0c3148',
  dagreWidth: 380,
  dagreHeight: (node) => {
    const inputRows = node.data.inputs?.length || 0;
    const keyRows   = node.data.groupByInputIds?.length || 0;
    const aggRows   = node.data.aggregations?.length || 0;
    return 60 + Math.max(inputRows, keyRows + aggRows + 1) * 26;
  },
  make: (x, y) => ({
    id: uid(),
    type: 'groupByNode',
    position: { x, y },
    data: { label: 'my_groupby', inputs: [], groupByInputIds: [], aggregations: [] },
  }),
  menu: { label: 'Group By', icon: '⊞', btnClass: 'bg-sky-900 hover:bg-sky-800 text-sky-100' },
  // column-level handles — covered by global *-source → *-target rule
  connections: [],
};

export default groupByConfig;
