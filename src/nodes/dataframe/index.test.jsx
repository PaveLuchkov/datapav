import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { DragProvider } from '../../components/DragContext';
import DataFrameNode from './index';

// Stub ReactFlow's Handle (needs the flow store) so the rewritten, primitive-based
// DataFrameNode can be rendered in isolation to verify UI fidelity after migration.
vi.mock('reactflow', () => ({
  Handle: ({ id }) => <div data-testid={`handle-${id}`} />,
  Position: { Left: 'left', Right: 'right' },
  // useDragSource cancels any in-flight connection on drag start
  useStoreApi: () => ({ getState: () => ({ cancelConnection: () => {} }) }),
}));

const wrap = (ui) => render(<DragProvider>{ui}</DragProvider>);

const baseData = (over = {}) => ({
  label: 'orders',
  attributes: [
    { id: 'a1', name: 'order_id', type: 'int' },
    { id: 'a2', name: 'note', type: 'string', broken: true },
  ],
  onAddAttribute: vi.fn(),
  onAttributeChange: vi.fn(),
  onAttributeTypeChange: vi.fn(),
  onDeleteAttribute: vi.fn(),
  onLabelChange: vi.fn(),
  onTraceColumn: vi.fn(),
  ...over,
});

test('renders label and all column names', () => {
  wrap(<DataFrameNode id="n1" data={baseData()} />);
  expect(screen.getByText('orders')).toBeInTheDocument();
  expect(screen.getByText('order_id')).toBeInTheDocument();
  expect(screen.getByText('note')).toBeInTheDocument();
});

test('a broken column shows the "!" marker and strikethrough', () => {
  wrap(<DataFrameNode id="n1" data={baseData()} />);
  expect(screen.getByText('!')).toBeInTheDocument();
  expect(screen.getByText('note').className).toContain('line-through');
});

test('an editable DataFrame shows the add-column button and no companion badge', () => {
  wrap(<DataFrameNode id="n1" data={baseData()} />);
  expect(screen.getByTitle('Add attribute')).toBeInTheDocument();
  expect(screen.queryByText('⊙')).toBeNull();
});

test('a companion DataFrame shows the ⊙ badge and hides the add-column button', () => {
  wrap(<DataFrameNode id="n1" data={baseData({ _companionOf: 'op1' })} />);
  expect(screen.getByText('⊙')).toBeInTheDocument();
  expect(screen.queryByTitle('Add attribute')).toBeNull();
});
