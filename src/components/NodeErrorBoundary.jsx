import { Component } from 'react';

export default class NodeErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="rounded-lg px-3 py-2 text-xs text-red-300 border border-red-800"
          style={{ background: '#1c0a0a', minWidth: 160 }}
        >
          <div className="font-semibold mb-0.5">Node error</div>
          <div className="opacity-60 font-mono truncate">{this.state.error.message}</div>
        </div>
      );
    }
    return this.props.children;
  }
}
