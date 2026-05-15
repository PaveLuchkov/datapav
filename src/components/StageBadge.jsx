import React from 'react';

const STAGES = [null, 'raw', 'staging', 'gold', 'final'];

const STAGE_STYLES = {
  raw:     { bg: 'rgba(71,85,105,0.5)',  text: '#cbd5e1' },
  staging: { bg: 'rgba(29,78,216,0.45)', text: '#bfdbfe' },
  gold:    { bg: 'rgba(180,83,9,0.5)',   text: '#fde68a' },
  final:   { bg: 'rgba(21,128,61,0.5)',  text: '#bbf7d0' },
};

export default function StageBadge({ nodeId, stage, onStageChange }) {
  const nextStage = STAGES[(STAGES.indexOf(stage) + 1) % STAGES.length];
  const s = STAGE_STYLES[stage];

  if (!stage) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onStageChange(nodeId, nextStage); }}
        onMouseDown={(e) => e.stopPropagation()}
        title="Set stage"
        className="flex-shrink-0 select-none transition-opacity"
        style={{ fontSize: 10, opacity: 0.25, lineHeight: 1 }}
      >
        ○
      </button>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onStageChange(nodeId, nextStage); }}
      onMouseDown={(e) => e.stopPropagation()}
      title={`Stage: ${stage} — click to change`}
      className="flex-shrink-0 rounded select-none font-medium transition-opacity hover:opacity-80"
      style={{ fontSize: 9, padding: '1px 5px', background: s.bg, color: s.text }}
    >
      {stage}
    </button>
  );
}
