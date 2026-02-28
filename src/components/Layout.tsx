import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  List,
  PieChart,
  Calendar as CalendarIcon,
  LogOut,
  Settings,
  CreditCard,
  Briefcase,
  Coffee,
  CircleDashed
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Layout() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/expenses', icon: List, label: 'Todos' },
    { to: '/expenses/estado', icon: CreditCard, label: 'Presupuestos' },
    { to: '/expenses/categoria', icon: PieChart, label: 'Categorías' },
    { to: '/expenses/calendar', icon: CalendarIcon, label: 'Calendario' },
    { to: '/settings', icon: Settings, label: 'Ajustes' },
  ];

  return (
    <div className="min-h-screen bg-[#f7f9f7] dark:bg-zinc-950 flex p-4 gap-4 font-sans text-zinc-900 dark:text-zinc-50 transition-colors">
      {/* Floating Sidebar */}
      <aside className="w-[280px] bg-white dark:bg-zinc-900 rounded-[40px] shadow-sm border border-zinc-100/50 dark:border-zinc-800 flex flex-col pt-8 pb-6 sticky top-4 h-[calc(100vh-32px)] transition-colors">

        <div className="px-8 mb-8 flex items-center gap-3 w-full">
          <div className="w-10 h-10 rounded-full bg-teal-900 dark:bg-teal-600 flex items-center justify-center shrink-0">
            <div className="w-4 h-8 bg-teal-100 dark:bg-teal-100/20 rounded-l-full -mr-1"></div>
            <div className="w-4 h-8 bg-teal-900 dark:bg-teal-600 rounded-r-full border-2 border-teal-100 dark:border-teal-100/20 -ml-1"></div>
          </div>
          <span className="font-bold text-xl tracking-tight text-teal-900 dark:text-teal-400">Inversion</span>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-4 px-5 py-4 rounded-3xl text-[15px] font-semibold transition-all duration-200",
                  isActive
                    ? "bg-teal-900 text-white shadow-md shadow-teal-900/20 translate-x-1 dark:bg-teal-600 dark:shadow-teal-900/40"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100"
                )
              }
            >
              <item.icon className={cn("w-5 h-5", item.to === '/' && !location.pathname.includes('/expenses') && !location.pathname.includes('/settings') && "text-teal-400 dark:text-teal-300")} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User Card */}
        <div className="px-6 mt-auto">
          <div className="bg-zinc-50 rounded-[28px] p-4 flex flex-col gap-4 border border-zinc-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-sm font-bold text-teal-800 shrink-0">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <p className="font-bold text-sm text-zinc-900 truncate">
                  {user?.email?.split('@')[0]}
                </p>
                <p className="text-xs text-zinc-400 truncate tracking-tight">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-[20px] text-sm font-bold text-zinc-600 bg-white hover:bg-rose-50 hover:text-rose-600 transition-colors shadow-sm border border-zinc-100"
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full h-[calc(100vh-32px)]">
        <div className="w-full mx-auto px-4 lg:px-6 2xl:px-8 2xl:max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
