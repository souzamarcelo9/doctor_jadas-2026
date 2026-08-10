export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex overflow-x-auto no-scrollbar border-b border-black/5 -mx-1 px-1">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`relative shrink-0 px-4 py-3 text-sm font-medium transition-colors focus-ring
            ${active === t ? "text-brand-700" : "text-ink-500 hover:text-ink-900"}`}
        >
          {t}
          {active === t && (
            <span className="absolute left-3 right-3 -bottom-px h-0.5 bg-brand-600 rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}
