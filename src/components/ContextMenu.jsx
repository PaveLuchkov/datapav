import { getNodeDisplayName } from '../nodes/registry';

export default function ContextMenu({ menu, addableNodes, onAddNode, onMerge, onDelete, canMerge }) {
  if (!menu) return null;

  return (
    <div
      className="absolute z-50 rounded-lg border border-slate-600 shadow-2xl overflow-hidden text-sm"
      style={{ left: menu.x, top: menu.y, background: '#1e293b', minWidth: 190 }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.type === 'pane' && (
        <>
          {addableNodes.map((item, i) => (
            <button
              key={item.type}
              onClick={() => onAddNode(item.type)}
              className={`w-full text-left px-4 py-2 hover:bg-slate-700 transition-colors ${i > 0 ? 'border-t border-slate-700' : ''}`}
              style={{ color: item.type === 'functionNode' ? '#6ee7b7' : '#e2e8f0' }}
            >
              {item.icon} Add {item.label} here
            </button>
          ))}
          {canMerge && (
            <button onClick={onMerge} className="w-full text-left px-4 py-2 text-violet-300 hover:bg-slate-700 transition-colors border-t border-slate-700">
              ⋈ Merge selected DFs
            </button>
          )}
        </>
      )}
      {menu.type === 'node' && (
        <button onClick={onDelete} className="w-full text-left px-4 py-2 text-red-400 hover:bg-slate-700 transition-colors">
          Delete {getNodeDisplayName(menu.nodeType)}
        </button>
      )}
    </div>
  );
}
