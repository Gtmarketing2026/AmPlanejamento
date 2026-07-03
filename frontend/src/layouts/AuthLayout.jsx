import { Outlet } from "react-router-dom"

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-bg text-text flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-[26px] h-[26px] rounded-[7px] bg-gradient-to-br from-accent to-blue relative">
            <div className="absolute inset-[7px] rounded-[3px] bg-bg" />
          </div>
          <div className="text-[15px] font-semibold">Fluxo</div>
        </div>
        <Outlet />
      </div>
    </div>
  )
}
