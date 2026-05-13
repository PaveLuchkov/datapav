import { render, screen, fireEvent } from '@testing-library/react';
import EditableText from './EditableText';

function setup(props = {}) {
  const onChange = jest.fn();
  render(<EditableText value="initial" onChange={onChange} placeholder="hint" {...props} />);
  return { onChange };
}

test('shows value in view mode', () => {
  setup();
  expect(screen.getByText('initial')).toBeInTheDocument();
});

test('shows placeholder when value is empty', () => {
  render(<EditableText value="" onChange={jest.fn()} placeholder="type here" />);
  expect(screen.getByText('type here')).toBeInTheDocument();
});

test('enters edit mode on double click', () => {
  setup();
  fireEvent.dblClick(screen.getByText('initial'));
  expect(screen.getByDisplayValue('initial')).toBeInTheDocument();
});

test('commits new value on Enter', () => {
  const { onChange } = setup();
  fireEvent.dblClick(screen.getByText('initial'));
  const input = screen.getByDisplayValue('initial');
  fireEvent.change(input, { target: { value: 'updated' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onChange).toHaveBeenCalledWith('updated');
});

test('reverts to original on Escape', () => {
  const { onChange } = setup();
  fireEvent.dblClick(screen.getByText('initial'));
  const input = screen.getByDisplayValue('initial');
  fireEvent.change(input, { target: { value: 'abandoned' } });
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByText('initial')).toBeInTheDocument();
});

test('does not commit on Enter if value unchanged', () => {
  const { onChange } = setup();
  fireEvent.dblClick(screen.getByText('initial'));
  const input = screen.getByDisplayValue('initial');
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onChange).not.toHaveBeenCalled();
});

test('does not commit empty value', () => {
  const { onChange } = setup();
  fireEvent.dblClick(screen.getByText('initial'));
  const input = screen.getByDisplayValue('initial');
  fireEvent.change(input, { target: { value: '   ' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onChange).not.toHaveBeenCalled();
});
