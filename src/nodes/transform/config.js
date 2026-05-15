import { uid } from '../../utils/uid';

const colors = {
  bg:          '#1c0e02',
  header:      '#7c2d12',
  border:      '#ea580c',
  handleFill:  '#f97316',
  handleBorder:'#1c0e02',
};

export const TRANSFORM_OPS = ['drop_duplicates', 'dropna', 'fillna', 'astype', 'sort_values'];

const transformConfig = {
  type: 'transformNode',
  colors,
  minimapColor: '#7c2d12',
  dagreWidth: 300,
  dagreHeight: (node) => 52 + Math.max(1, node.data.ops?.length || 0) * 32 + 24,
  make: (x, y) => ({
    id: uid(),
    type: 'transformNode',
    position: { x, y },
    data: {
      label: 'transform',
      ops: [{ id: uid(), type: 'drop_duplicates', args: {} }],
      code: '',
      stage: null,
    },
  }),
  menu: { label: 'Transform', icon: '⚙', btnClass: 'bg-orange-800 hover:bg-orange-700 text-orange-100' },
  connections: [],
};

export default transformConfig;
