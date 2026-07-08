import { Outlet } from "react-router-dom"
import Logo from "../components/ui/Logo"

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-bg text-text flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>
        <Outlet />
      </div>
    </div>
  )
}
