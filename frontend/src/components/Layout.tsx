import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LogOut, Home, FileText, Sun, Moon, Menu, X,
  BarChart3, BrainCircuit, BookOpen, Table, Bot,
  Building2, ExternalLink, MessageSquare, Monitor,
  Camera, AlertTriangle, Archive, LineChart, ListChecks, ClipboardList,
} from 'lucide-react';
import { User } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface LayoutProps {
  user: User;
  onLogout: () => void;
}

interface NavItemDef {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const reportNavItems: NavItemDef[] = [
  { to: '/report/our-city', label: 'Наш Город', icon: MessageSquare },
  { to: '/report/mayor-monitor', label: 'Монитор Мэра', icon: Monitor },
  { to: '/report/prefect', label: 'Префект', icon: Building2 },
  { to: '/report/mzhi', label: 'МЖИ', icon: FileText },
  { to: '/report/mzhi-statistics', label: 'Статистика МЖИ', icon: BarChart3 },
  { to: '/report/tsafap', label: 'Нарушения ЦАФАП', icon: Camera },
  { to: '/report/oati', label: 'Нарушения ОАТИ', icon: AlertTriangle },
  { to: '/report/bot-transfers', label: 'Заявки на перенос', icon: ClipboardList },
];

const toolNavItems: NavItemDef[] = [
  { to: '/scripts', label: 'Скрипты', icon: BrainCircuit },
  { to: '/knowledge', label: 'База знаний', icon: BookOpen },
];

const analyticsNavItems: (NavItemDef & { prefectOnly?: boolean })[] = [
  { to: '/analytics/archive', label: 'Архив отчетов', icon: Archive, prefectOnly: true },
  { to: '/analytics/dashboard', label: 'Дашборд ММ', icon: LineChart },
  { to: '/analytics/ng-overdue', label: 'Дашборд НГ', icon: ListChecks },
  { to: '/analytics/transfer-statistics', label: 'Статистика переносов', icon: BarChart3, prefectOnly: true },
];

const externalLinks = [
  { url: 'https://docs.google.com/spreadsheets/d/1aiwbR2KdnooBmsR_-Qf9jahYEb2fyjjz29WOU8Xuq0s/edit?gid=0#gid=0', label: 'КГХ Таблица', icon: Table },
  { url: 'https://web.tdm.mos.ru/user/-3184800957815138', label: 'Бот переносов', icon: Bot },
];

interface SidebarNavItemProps extends NavItemDef {
  isActive: boolean;
  onClick: () => void;
}

function SidebarNavItem({ to, label, icon: Icon, isActive, onClick }: SidebarNavItemProps) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`
        relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
        transition-all duration-200 group
        ${isActive
          ? 'bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/70 hover:text-gray-900 dark:hover:text-gray-100'
        }
      `}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary-500 dark:bg-primary-400 rounded-r-full" />
      )}
      <Icon
        size={17}
        className={`flex-shrink-0 transition-transform duration-200 ${
          isActive ? 'text-primary-600 dark:text-primary-400' : 'group-hover:scale-110'
        }`}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pt-3">
      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest px-3 mb-1.5 select-none">
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Layout({ user, onLogout }: LayoutProps) {
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const closeSidebar = () => setSidebarOpen(false);

  const initials = user.name
    ?.split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('') || '?';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300 ${
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeSidebar}
      />

      {/* ─── Sidebar ──────────────────────────────────────────── */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 z-40 flex flex-col
          bg-white dark:bg-gray-900
          border-r border-gray-100 dark:border-gray-800/80
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-gray-800/80">
          <Link to="/" onClick={closeSidebar} className="flex items-center gap-3 group min-w-0">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-glow-sm flex-shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight min-w-0">
              <p className="font-bold text-gray-900 dark:text-white text-sm truncate">Префектура</p>
              <p className="text-[11px] text-primary-600 dark:text-primary-400 font-semibold tracking-wide">ЮВАО</p>
            </div>
          </Link>
          <button
            onClick={closeSidebar}
            className="md:hidden p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          <SidebarNavItem to="/" label="Главная" icon={Home} isActive={isActive('/')} onClick={closeSidebar} />

          <NavGroup label="Отчеты">
            {reportNavItems
              .filter(item => !(
                (item.to === '/report/tsafap' || item.to === '/report/oati') &&
                user.duty !== 'Префектура'
              ))
              .map(item => (
                <SidebarNavItem key={item.to} {...item} isActive={isActive(item.to)} onClick={closeSidebar} />
              ))}
          </NavGroup>

          <NavGroup label="Инструменты">
            {toolNavItems.map(item => (
              <SidebarNavItem key={item.to} {...item} isActive={isActive(item.to)} onClick={closeSidebar} />
            ))}
          </NavGroup>

          <NavGroup label="Аналитика">
            {analyticsNavItems
              .filter(item => !item.prefectOnly || user.duty === 'Префектура')
              .map(item => (
                <SidebarNavItem key={item.to} {...item} isActive={isActive(item.to)} onClick={closeSidebar} />
              ))}
          </NavGroup>

          <NavGroup label="Внешние ресурсы">
            {externalLinks.map(link => (
              <button
                key={link.url}
                onClick={() => { window.open(link.url, '_blank', 'noopener,noreferrer'); closeSidebar(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/70 hover:text-gray-900 dark:hover:text-gray-100 transition-all duration-200 group"
              >
                <link.icon size={17} className="flex-shrink-0 group-hover:scale-110 transition-transform duration-200" />
                <span className="truncate">{link.label}</span>
                <ExternalLink size={11} className="ml-auto flex-shrink-0 opacity-40 group-hover:opacity-70" />
              </button>
            ))}
          </NavGroup>
        </nav>

        {/* User info */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800/80">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-700 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.organization}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Main Content ─────────────────────────────────────── */}
      <div className="md:ml-64 min-h-screen flex flex-col">

        {/* Header */}
        <header className="sticky top-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-100/80 dark:border-gray-800/80">
          <div className="flex items-center px-4 py-3 gap-3">
            {/* Mobile hamburger + logo */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
            >
              <Menu size={20} />
            </button>
            <div className="md:hidden flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-gray-900 dark:text-white text-sm truncate">Префектура ЮВАО</span>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-2 ml-auto">
              <div className="hidden md:flex flex-col items-end mr-1">
                <span className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{user.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{user.organization}</span>
              </div>

              <button
                onClick={toggleTheme}
                className="p-2 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200"
                title={isDark ? 'Светлая тема' : 'Тёмная тема'}
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 text-sm font-medium"
                title="Выйти"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Выйти</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default Layout;
