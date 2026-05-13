import { uid } from '../../utils/uid';

export const NOTE_PALETTE = [
  { key: 'yellow', bg: '#fef9c3', border: '#fbbf24', text: '#7c2d12' },
  { key: 'pink',   bg: '#fce7f3', border: '#f472b6', text: '#831843' },
  { key: 'green',  bg: '#dcfce7', border: '#4ade80', text: '#14532d' },
  { key: 'blue',   bg: '#dbeafe', border: '#60a5fa', text: '#1e3a8a' },
  { key: 'purple', bg: '#f3e8ff', border: '#c084fc', text: '#581c87' },
];

const commentConfig = {
  type: 'commentNode',
  minimapColor: '#fbbf24',
  dagreWidth: 200,
  dagreHeight: () => 120,
  make: (x, y) => ({
    id: uid(),
    type: 'commentNode',
    position: { x, y },
    data: { text: '', color: 'yellow' },
  }),
  menu: { label: 'Comment', icon: '✎', btnClass: 'bg-yellow-700 hover:bg-yellow-600 text-yellow-100' },
  connections: [],
};

export default commentConfig;
