import { render, screen } from '@testing-library/react';
import App from './App';

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

test('renders toolbar buttons', () => {
  render(<App />);
  expect(screen.getByText('+ DataFrame')).toBeInTheDocument();
  expect(screen.getByText('Save')).toBeInTheDocument();
  expect(screen.getByText('Export PNG')).toBeInTheDocument();
});
