import { Outlet } from "react-router-dom"
import Topbar from "../components/layout/Topbar"
import { PlanProvider } from "../context/PlanContext"

export default function AppLayout() {
  return (
    <PlanProvider>
      <div className="min-h-screen bg-bg text-text">
        <Topbar />
        <Outlet />
      </div>
    </PlanProvider>
  )
}
