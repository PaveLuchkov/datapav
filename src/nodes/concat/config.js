import { uid } from '../../utils/uid';

const colors = {
  bg:          '#1f0814',
  header:      '#4c0519',
  border:      '#9f1239',
  handleFill:  '#fb7185',
  handleBorder:'#1f0814',
};

const concatConfig = {
  type: 'concatNode',
  colors,
  minimapColor: '#4c0519',
  dagreWidth: 260,
  dagreHeight: () => 120,
  make: (x, y) => ({
    id: uid(),
    type: 'concatNode',
    position: { x, y },
    data: {
      label: 'concat',
      code: '',
      stage: null,
    },
  }),
  menu: { label: 'Concat', icon: '∪', btnClass: 'bg-rose-900 hover:bg-rose-800 text-rose-100' },
  connections: [],
};

export default concatConfig;
