import { uid } from '../../utils/uid';

const colors = {
  bg:          '#160d2e',
  header:      '#2e1065',
  border:      '#4c1d95',
  handleLeft:  '#7c3aed',
  handleRight: '#9333ea',
  handleBorder:'#2e1065',
};

const mergeConfig = {
  type: 'mergeNode',
  colors,
  minimapColor: '#2e1065',
  dagreWidth: 380,
  dagreHeight: () => 200,
  make: (x, y) => ({
    id: uid(),
    type: 'mergeNode',
    position: { x, y },
    data: { joinType: 'inner', keyPairs: [], code: '', stage: null },
  }),
  // No menu entry — merge is created via 2-DF selection, not direct add
  connections: [],
};

export default mergeConfig;
