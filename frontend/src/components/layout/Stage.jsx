export default function Stage({ eyebrow, title, description, children }) {
  return (
    <div className="max-w-[1360px] mx-auto px-8 py-10 pb-24">
      {(eyebrow || title) && (
        <div className="mb-6">
          {eyebrow && (
            <span className="block font-mono text-[11px] text-accent uppercase tracking-wide mb-2">
              {eyebrow}
            </span>
          )}
          {title && <h1 className="font-display text-2xl font-semibold mb-1.5">{title}</h1>}
          {description && <p className="text-text-dim text-sm max-w-lg leading-relaxed">{description}</p>}
        </div>
      )}
      {children}
    </div>
  )
}
