import React from 'react';
import { Handle, Position } from 'reactflow';

const JOIN_TYPES = ['inner', 'left', 'right', 'outer'];

const JOIN_ACTIVE = {
  inner: 'bg-blue-600 text-white',
  left:  'bg-violet-600 text-white',
  right: 'bg-pink-600 text-white',
  outer: 'bg-amber-600 text-white',
};

export default function MergeNode({ id, data }) {
  const { joinType, keyPairs, onJoinTypeChange, onAddKey, onRemoveKey, onUpdateKey } = data;

  const stop = (e) => e.stopPropagation();

  return (
    <div
      className="rounded-lg overflow-visible shadow-2xl"
      style={{ background: '#160d2e', border: '1px solid #4c1d95', minWidth: 260 }}
      onContextMenu={stop}
    >
      {/* Left handles with L / R labels */}
      <div style={{ position: 'absolute', left: -22, top: 0, height: '100%', pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-around', paddingTop: 32, paddingBottom: 16 }}>
        <span style={{ fontSize: 10, color: '#a78bfa', fontWeight: 700, userSelect: 'none' }}>L</span>
        <span style={{ fontSize: 10, color: '#c084fc', fontWeight: 700, userSelect: 'none' }}>R</span>
      </div>

      <Handle
        type="target" id="left-in" position={Position.Left}
        style={{ top: '32%', background: '#7c3aed', border: '2px solid #2e1065', width: 10, height: 10 }}
      />
      <Handle
        type="target" id="right-in" position={Position.Left}
        style={{ top: '68%', background: '#9333ea', border: '2px solid #2e1065', width: 10, height: 10 }}
      />
      <Handle
        type="source" id="out" position={Position.Right}
        style={{ background: '#7c3aed', border: '2px solid #2e1065', width: 10, height: 10 }}
      />

      {/* Header */}
      <div
        className="px-3 py-2 border-b border-purple-900 flex items-center justify-between cursor-grab"
        style={{ background: '#2e1065' }}
      >
        <span className="text-purple-200 font-bold text-sm tracking-widest">⋈ MERGE</span>
        <div className="flex gap-0.5">
          {JOIN_TYPES.map((jt) => (
            <button
              key={jt}
              onClick={(e) => { stop(e); onJoinTypeChange(id, jt); }}
              onMouseDown={stop}
              className={`px-1.5 py-0.5 text-xs rounded font-medium transition-colors ${
                joinType === jt ? JOIN_ACTIVE[jt] : 'text-purple-400 hover:bg-purple-900'
              }`}
            >
              {jt}
            </button>
          ))}
        </div>
      </div>

      {/* Input labels row */}
      <div className="flex justify-between px-3 py-1.5 border-b border-purple-900/50">
        <span className="text-xs text-violet-400 flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-violet-500" /> Left DF
        </span>
        <span className="text-xs text-purple-400 flex items-center gap-1">
          Right DF <span className="inline-block w-2 h-2 rounded-full bg-purple-500" />
        </span>
      </div>

      {/* Key pairs */}
      <div className="px-3 py-2">
        <div className="text-xs text-purple-500 font-semibold mb-1.5 uppercase tracking-wider">Join keys</div>

        {keyPairs.length === 0 && (
          <div className="text-xs text-purple-700 italic mb-1">No keys — will cross join</div>
        )}

        {keyPairs.map((pair, i) => (
          <div key={i} className="flex items-center gap-1 mb-1.5">
            <input
              value={pair.left}
              onChange={(e) => { stop(e); onUpdateKey(id, i, 'left', e.target.value); }}
              onMouseDown={stop}
              onKeyDown={stop}
              className="bg-purple-950/70 border border-purple-800 text-purple-100 text-xs px-1.5 py-0.5 rounded w-24 outline-none focus:border-violet-500 transition-colors"
              placeholder="left col"
            />
            <span className="text-purple-600 text-xs font-mono select-none">=</span>
            <input
              value={pair.right}
              onChange={(e) => { stop(e); onUpdateKey(id, i, 'right', e.target.value); }}
              onMouseDown={stop}
              onKeyDown={stop}
              className="bg-purple-950/70 border border-purple-800 text-purple-100 text-xs px-1.5 py-0.5 rounded w-24 outline-none focus:border-violet-500 transition-colors"
              placeholder="right col"
            />
            <button
              onClick={(e) => { stop(e); onRemoveKey(id, i); }}
              onMouseDown={stop}
              className="text-red-500 hover:text-red-300 text-xs w-4 h-4 flex items-center justify-center flex-shrink-0 transition-colors"
            >
              ×
            </button>
          </div>
        ))}

        <button
          onClick={(e) => { stop(e); onAddKey(id); }}
          onMouseDown={stop}
          className="text-purple-500 hover:text-purple-300 text-xs flex items-center gap-1 transition-colors"
        >
          + add key
        </button>
      </div>
    </div>
  );
}
