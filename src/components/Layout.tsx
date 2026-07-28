import { NavLink, Outlet, useLocation } from 'react-router-dom'

const tabs = [
  { path: '/record',   label: '记账', icon: '✏️' },
  { path: '/bills',    label: '账单', icon: '📋' },
  { path: '/chart',    label: '图表', icon: '📊' },
  { path: '/accounts', label: '资产', icon: '💼' },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div className="flex flex-col h-dvh bg-white max-w-lg mx-auto">
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <nav className="flex border-t border-gray-100 bg-white pb-3 pt-1">
        {tabs.map(tab => {
          const active = location.pathname.startsWith(tab.path)
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={`flex-1 flex flex-col items-center py-1 text-xs gap-0.5 ${
                active ? 'text-yellow-500' : 'text-gray-400'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span>{tab.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
