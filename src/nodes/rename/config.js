import { uid } from '../../utils/uid';

const colors = {
  bg:          '#1a1040',
  header:      '#2d1b6e',
  border:      '#4f35b0',
  handleFill:  '#818cf8',
  handleBorder:'#1a1040',
};

const renameConfig = {
  type: 'renameNode',
  colors,
  minimapColor: '#2d1b6e',
  dagreWidth: 280,
  dagreHeight: (node) => 42 + Math.max(1, node.data.mappings?.length || 0) * 28 + 16,
  make: (x, y) => ({
    id: uid(),
    type: 'renameNode',
    position: { x, y },
    data: {
      label: 'rename',
      mappings: [{ id: uid(), from: '', to: '' }],
      code: '',
      stage: null,
    },
  }),
  menu: { label: 'Rename', icon: '⟲', btnClass: 'bg-indigo-800 hover:bg-indigo-700 text-indigo-100' },
  connections: [],
};

export default renameConfig;
