import { uid } from '../../utils/uid';

const colors = {
  bg:          '#0f2744',
  header:      '#1a3a5c',
  border:      '#1e4d8c',
  handleFill:  '#0d9488',
  handleBorder:'#042f2e',
};

const dataframeConfig = {
  type: 'dataFrameNode',
  colors,
  minimapColor: '#1a3a5c',
  dagreWidth: 220,
  dagreHeight: (node) => 42 + Math.max(1, node.data.attributes?.length || 0) * 28 + 16,
  make: (x, y, dataOverrides = {}) => ({
    id: uid(),
    type: 'dataFrameNode',
    position: { x, y },
    data: {
      label: 'new_dataframe',
      attributes: [{ id: uid(), name: 'column_1', type: 'string' }],
      code: '',
      stage: null,
      ...dataOverrides,
    },
  }),
  menu: { label: 'DataFrame', icon: '+', btnClass: 'bg-blue-700 hover:bg-blue-600 text-white' },
  // sourceHandle → allowed targetHandles (exact string matches)
  connections: [
    ['df-out', 'left-in'],
    ['df-out', 'right-in'],
  ],
};

export default dataframeConfig;
