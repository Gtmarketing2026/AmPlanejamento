export default function DeviceFrame({ url, children }) {
  return (
    <div className="bg-panel border border-line rounded-2xl overflow-hidden shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-line bg-panel-2">
        <span className="w-2 h-2 rounded-full bg-line" />
        <span className="w-2 h-2 rounded-full bg-line" />
        <span className="w-2 h-2 rounded-full bg-line" />
        {url && <span className="ml-2.5 text-[11px] text-text-faint font-mono">{url}</span>}
      </div>
      <div className="p-8">{children}</div>
    </div>
  )
}
