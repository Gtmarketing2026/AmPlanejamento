export default function PhoneFrame({ children, width = 340 }) {
  return (
    <div
      className="mx-auto bg-panel border border-line rounded-[34px] p-3.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]"
      style={{ width }}
    >
      <div className="w-[90px] h-[5px] bg-line rounded-full mx-auto mb-3.5" />
      <div className="bg-bg rounded-[22px] px-5 py-6 min-h-[520px]">{children}</div>
    </div>
  )
}
