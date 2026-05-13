import { render, screen, fireEvent } from '@testing-library/react';
import ContextMenu from './ContextMenu';

const paneMenu = { x: 100, y: 200, type: 'pane', flowX: 100, flowY: 200 };
const nodeMenu = { x: 50, y: 60, type: 'node', nodeId: 'n1', nodeType: 'dataFrameNode' };

test('renders nothing when menu is null', () => {
  const { container } = render(<ContextMenu menu={null} />);
  expect(container.firstChild).toBeNull();
});

test('shows pane options', () => {
  render(<ContextMenu menu={paneMenu} onAddNode={jest.fn()} onAddFunction={jest.fn()} canMerge={false} />);
  expect(screen.getByText(/Add DataFrame/)).toBeInTheDocument();
  expect(screen.getByText(/Add Function/)).toBeInTheDocument();
});

test('hides merge option when canMerge is false', () => {
  render(<ContextMenu menu={paneMenu} canMerge={false} />);
  expect(screen.queryByText(/Merge selected/)).toBeNull();
});

test('shows merge option when canMerge is true', () => {
  render(<ContextMenu menu={paneMenu} canMerge={true} onMerge={jest.fn()} />);
  expect(screen.getByText(/Merge selected/)).toBeInTheDocument();
});

test('calls onAddNode when clicked', () => {
  const onAddNode = jest.fn();
  render(<ContextMenu menu={paneMenu} onAddNode={onAddNode} onAddFunction={jest.fn()} canMerge={false} />);
  fireEvent.click(screen.getByText(/Add DataFrame/));
  expect(onAddNode).toHaveBeenCalledTimes(1);
});

test('shows delete for DataFrame node', () => {
  render(<ContextMenu menu={nodeMenu} onDelete={jest.fn()} />);
  expect(screen.getByText('Delete DataFrame')).toBeInTheDocument();
});

test('shows delete for MergeNode', () => {
  render(<ContextMenu menu={{ ...nodeMenu, nodeType: 'mergeNode' }} onDelete={jest.fn()} />);
  expect(screen.getByText('Delete Merge')).toBeInTheDocument();
});

test('calls onDelete when delete button clicked', () => {
  const onDelete = jest.fn();
  render(<ContextMenu menu={nodeMenu} onDelete={onDelete} />);
  fireEvent.click(screen.getByText('Delete DataFrame'));
  expect(onDelete).toHaveBeenCalledTimes(1);
});
