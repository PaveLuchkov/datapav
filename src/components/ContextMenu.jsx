export default function ContextMenu({ menu, onAddNode, onAddFunction, onMerge, onDelete, canMerge }) {
  if (!menu) return null;

  const nodeLabel = menu.nodeType === 'mergeNode' ? 'Merge'
    : menu.nodeType === 'functionNode' ? 'Function'
    : 'DataFrame';

  return (
    <div
      className="absolute z-50 rounded-lg border border-slate-600 shadow-2xl overflow-hidden text-sm"
      style={{ left: menu.x, top: menu.y, background: '#1e293b', minWidth: 190 }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.type === 'pane' && (
        <>
          <button onClick={onAddNode} className="w-full text-left px-4 py-2 text-slate-200 hover:bg-slate-700 transition-colors">
            + Add DataFrame here
          </button>
          <button onClick={onAddFunction} className="w-full text-left px-4 py-2 text-emerald-300 hover:bg-slate-700 transition-colors border-t border-slate-700">
            ƒ Add Function here
          </button>
          {canMerge && (
            <button onClick={onMerge} className="w-full text-left px-4 py-2 text-violet-300 hover:bg-slate-700 transition-colors border-t border-slate-700">
              ⋈ Merge selected DFs
            </button>
          )}
        </>
      )}
      {menu.type === 'node' && (
        <button onClick={onDelete} className="w-full text-left px-4 py-2 text-red-400 hover:bg-slate-700 transition-colors">
          Delete {nodeLabel}
        </button>
      )}
    </div>
  );
}
