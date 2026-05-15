import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import EditableText from '../../components/EditableText';
import StageBadge from '../../components/StageBadge';
import NodeCodeBlock from '../../components/NodeCodeBlock';
import config from './config';

const { colors } = config;

export default function ConcatNode({ id, data }) {
  const {
    label, connectedDFs = [],
    onLabelChange, onCodeChange, onStageChange,
    code, stage,
  } = data;

  const [codeOpen, setCodeOpen] = useState(false);
  const stop = (e) => e.stopPropagation();

  return (
    <div
      className="rounded-lg overflow-visible shadow-xl"
      style={{ background: colors.bg, border: `1px solid ${colors.border}`, minWidth: 240 }}
      onContextMenu={stop}
    >
      <Handle
        type="target" id="df-in" position={Position.Left}
        style={{ top: 14, background: colors.handleFill, border: `2px solid ${colors.handleBorder}`, width: 8, height: 8, borderRadius: 2 }}
      />
      <Handle
        type="source" id="df-out" position={Position.Right}
        style={{ top: 14, background: colors.handleFill, border: `2px solid ${colors.handleBorder}`, width: 8, height: 8, borderRadius: 2 }}
      />

      <div
        className="px-3 py-2 border-b flex items-center gap-2 cursor-grab active:cursor-grabbing"
        style={{ background: colors.header, borderColor: colors.border }}
      >
        <span className="font-mono font-bold select-none" style={{ color: colors.handleFill, fontSize: 14 }}>∪</span>
        <EditableText
          value={label}
          onChange={(val) => onLabelChange(id, val)}
          className="text-white font-semibold text-sm flex-1"
          placeholder="concat"
          borderColorClass="border-rose-400"
        />
        <StageBadge nodeId={id} stage={stage} onStageChange={onStageChange} />
        <button
          onClick={(e) => { stop(e); setCodeOpen((v) => !v); }}
          onMouseDown={stop}
          title="Toggle code snippet"
          className="flex-shrink-0 select-none transition-opacity hover:opacity-100 font-mono"
          style={{ fontSize: 10, color: colors.handleFill, opacity: codeOpen ? 1 : 0.4 }}
        >
          {codeOpen ? '[/]' : '</>'}
        </button>
      </div>

      <div className="py-2 px-3">
        {connectedDFs.length === 0 ? (
          <div className="text-xs italic" style={{ color: '#9f1239' }}>
            Connect DataFrames via df-out → df-in
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {connectedDFs.map((df, i) => (
              <div key={df.sourceNodeId} className="flex items-center gap-1.5">
                <span className="text-xs select-none" style={{ color: '#9f1239', fontSize: 9 }}>▸</span>
                <span className="text-xs truncate" style={{ color: '#fda4af' }}>{df.sourceNodeLabel}</span>
                {i < connectedDFs.length - 1 && (
                  <span className="text-xs font-mono ml-auto select-none" style={{ color: '#4c0519' }}>UNION</span>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 pt-1.5 border-t text-xs font-mono select-none" style={{ borderColor: '#4c0519', color: '#6b2137' }}>
          → UNION ALL
        </div>
      </div>

      {codeOpen && <NodeCodeBlock nodeId={id} code={code} onCodeChange={onCodeChange} borderColor={colors.border} />}
    </div>
  );
}
