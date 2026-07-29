import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Users, UserPlus, Edit, Trash2, Save, X,
  Search, RefreshCw, Activity, Shield, AlertTriangle,
  ChevronDown, ChevronUp, ChevronsUpDown,
  Eye, EyeOff, UserCheck, CalendarDays,
} from 'lucide-react';
import api from '../utils/api';

interface User {
  id: number;
  name: string;
  login: string;
  organization: string;
  duty: string;
  last_visit: string;
}

interface Organization { id: number; name: string; }
interface Duty        { id: number; name: string; }

interface ActivityItem {
  id: number;
  name: string;
  login: string;
  last_visit: string;
  organization: string;
  duty: string;
}

type SortOrder = 'asc' | 'desc' | null;
type UserSortField     = 'id' | 'name' | 'login' | 'organization' | 'duty' | 'last_visit';
type ActivitySortField = 'name' | 'login' | 'organization' | 'duty' | 'last_visit';

// ── Helpers ──────────────────────────────────────────────────────────

// Parse "DD.MM.YYYY HH:MM:SS" → timestamp (fixes lexical date sort bug)
function parseDateStr(str: string): number {
  if (!str) return 0;
  const m = str.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return 0;
  return new Date(
    +m[3], +m[2] - 1, +m[1],
    +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)
  ).getTime();
}

function getActivityBadge(lastVisit: string) {
  const ts = parseDateStr(lastVisit);
  if (!ts) return null;
  const h = (Date.now() - ts) / 3_600_000;
  if (h <  1) return { text: 'Недавно',   cls: 'bg-green-100  text-green-700  dark:bg-green-900/40  dark:text-green-300'  };
  if (h < 24) return { text: 'Сегодня',   cls: 'bg-green-100  text-green-700  dark:bg-green-900/40  dark:text-green-300'  };
  if (h < 48) return { text: 'Вчера',     cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' };
  return null;
}

const AVATAR_COLORS = [
  'from-violet-500 to-violet-700', 'from-blue-500 to-blue-700',
  'from-emerald-500 to-emerald-700', 'from-rose-500 to-rose-700',
  'from-amber-500 to-amber-700', 'from-indigo-500 to-indigo-700',
  'from-teal-500 to-teal-700', 'from-pink-500 to-pink-700',
];

const getInitials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

// ── Sort header cell ──────────────────────────────────────────────────

interface SortThProps {
  label: string;
  field: string;
  sortField: string | null;
  sortOrder: SortOrder;
  onSort: (f: string) => void;
  className?: string;
}

function SortTh({ label, field, sortField, sortOrder, onSort, className = '' }: SortThProps) {
  const active = sortField === field;
  return (
    <th
      onClick={() => onSort(field)}
      className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider cursor-pointer select-none group transition-colors whitespace-nowrap
        ${active
          ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/40'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/60'
        } ${className}`}
    >
      <div className="flex items-center gap-1">
        {label}
        {active
          ? (sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
          : <ChevronsUpDown size={12} className="opacity-0 group-hover:opacity-40 transition-opacity" />
        }
      </div>
    </th>
  );
}

// ── Main component ────────────────────────────────────────────────────

const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab]             = useState<'users' | 'activity'>('users');
  const [users, setUsers]                     = useState<User[]>([]);
  const [activities, setActivities]           = useState<ActivityItem[]>([]);
  const [organizations, setOrganizations]     = useState<Organization[]>([]);
  const [dutys, setDutys]                     = useState<Duty[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [isAdmin, setIsAdmin]                 = useState(false);
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const [searchTerm, setSearchTerm]           = useState('');
  const [showPassword, setShowPassword]       = useState(false);

  const [sortField,  setSortField]  = useState<UserSortField | null>(null);
  const [sortOrder,  setSortOrder]  = useState<SortOrder>(null);

  // Activity table defaults to last_visit DESC
  const [actSortField, setActSortField] = useState<ActivitySortField | null>('last_visit');
  const [actSortOrder, setActSortOrder] = useState<SortOrder>('desc');

  const [showUserModal,     setShowUserModal]     = useState(false);
  const [editingUser,       setEditingUser]       = useState<User | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete,      setUserToDelete]      = useState<number | null>(null);

  const [userForm, setUserForm] = useState({
    name: '', login: '', password: '', id_organization: 1, id_duty: 1,
  });

  useEffect(() => {
    const checkAdmin = async () => {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        try {
          const { is_admin } = JSON.parse(savedUser);
          setIsAdmin(!!is_admin);
        } catch { setIsAdmin(false); }
      }
      setIsAdminVerified(true);
    };
    checkAdmin();
  }, []);

  useEffect(() => { if (isAdmin) loadData(); }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [uRes, oRes, dRes, aRes] = await Promise.all([
        api.get('/api/admin/users'),
        api.get('/api/admin/organizations'),
        api.get('/api/admin/dutys'),
        api.get('/api/admin/activity'),
      ]);
      setUsers(uRes.data.users);
      setOrganizations(oRes.data.organizations);
      setDutys(dRes.data.dutys);
      setActivities(aRes.data.activities);
    } catch (e) {
      console.error('Error loading data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: string) => {
    const f = field as UserSortField;
    const next: SortOrder = sortField === f
      ? sortOrder === 'asc' ? 'desc' : sortOrder === 'desc' ? null : 'asc'
      : 'asc';
    setSortField(next ? f : null);
    setSortOrder(next);
  };

  const handleActSort = (field: string) => {
    const f = field as ActivitySortField;
    const next: SortOrder = actSortField === f
      ? actSortOrder === 'asc' ? 'desc' : actSortOrder === 'desc' ? null : 'asc'
      : 'asc';
    setActSortField(next ? f : null);
    setActSortOrder(next);
  };

  const filteredUsers = useMemo(() =>
    users.filter(u =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.login.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.organization.toLowerCase().includes(searchTerm.toLowerCase())
    ), [users, searchTerm]);

  const sortedUsers = useMemo(() => {
    if (!sortField || !sortOrder) return filteredUsers;
    return [...filteredUsers].sort((a, b) => {
      if (sortField === 'id')
        return sortOrder === 'asc' ? a.id - b.id : b.id - a.id;
      if (sortField === 'last_visit') {
        const diff = parseDateStr(a.last_visit) - parseDateStr(b.last_visit);
        return sortOrder === 'asc' ? diff : -diff;
      }
      const av = String(a[sortField]).toLowerCase();
      const bv = String(b[sortField]).toLowerCase();
      return sortOrder === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [filteredUsers, sortField, sortOrder]);

  const sortedActivities = useMemo(() => {
    if (!actSortField || !actSortOrder) return activities;
    return [...activities].sort((a, b) => {
      if (actSortField === 'last_visit') {
        const diff = parseDateStr(a.last_visit) - parseDateStr(b.last_visit);
        return actSortOrder === 'asc' ? diff : -diff;
      }
      const av = String(a[actSortField]).toLowerCase();
      const bv = String(b[actSortField]).toLowerCase();
      return actSortOrder === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [activities, actSortField, actSortOrder]);

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      total: users.length,
      today: users.filter(u => (now - parseDateStr(u.last_visit)) < 86_400_000).length,
      week:  users.filter(u => (now - parseDateStr(u.last_visit)) < 604_800_000).length,
    };
  }, [users]);

  const handleOpenCreate = () => {
    setEditingUser(null);
    setShowPassword(false);
    setUserForm({ name: '', login: '', password: '', id_organization: organizations[0]?.id || 1, id_duty: dutys[0]?.id || 1 });
    setShowUserModal(true);
  };

  const handleOpenEdit = (u: User) => {
    setEditingUser(u);
    setShowPassword(false);
    setUserForm({
      name: u.name, login: u.login, password: '',
      id_organization: organizations.find(o => o.name === u.organization)?.id || 1,
      id_duty: dutys.find(d => d.name === u.duty)?.id || 1,
    });
    setShowUserModal(true);
  };

  const handleSaveUser = async () => {
    try {
      if (editingUser) {
        await api.put(`/api/admin/users/${editingUser.id}`, userForm);
      } else {
        await api.post('/api/admin/users', userForm);
      }
      setShowUserModal(false);
      loadData();
    } catch { alert('Ошибка при сохранении пользователя'); }
  };

  const handleDeleteUser = async () => {
    if (userToDelete === null) return;
    try {
      await api.delete(`/api/admin/users/${userToDelete}`);
      setShowDeleteConfirm(false);
      setUserToDelete(null);
      loadData();
    } catch { alert('Ошибка при удалении пользователя'); }
  };

  // ── States before main render ────────────────────────────────────

  if (!isAdminVerified) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-[3px] border-gray-200 dark:border-gray-700" />
          <div className="absolute inset-0 rounded-full border-[3px] border-primary-500 border-t-transparent animate-spin" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Проверка прав доступа…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-5 text-center animate-fade-in">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Доступ запрещён</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">У вас нет прав для доступа к админ-панели</p>
        </div>
        <Link
          to="/"
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <ArrowLeft size={15} />
          На главную
        </Link>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 flex-shrink-0"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">Админ-панель</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Управление пользователями</p>
          </div>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium transition-all duration-150 active:scale-95 ml-[52px] sm:ml-0 w-fit"
        >
          <RefreshCw size={14} />
          Обновить
        </button>
      </div>

      {/* Stats cards */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-100 dark:bg-primary-950/50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Users className="w-4.5 h-4.5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white leading-none">{stats.total}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Всего</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-green-100 dark:bg-green-950/50 rounded-xl flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-4.5 h-4.5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white leading-none">{stats.today}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Сегодня</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 dark:bg-blue-950/50 rounded-xl flex items-center justify-center flex-shrink-0">
              <CalendarDays className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white leading-none">{stats.week}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">За неделю</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800/80 rounded-xl w-fit">
        {([
          { id: 'users',    label: 'Пользователи', icon: Users,    count: users.length },
          { id: 'activity', label: 'Активность',   icon: Activity, count: activities.length },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
            <span className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold leading-none ${
              activeTab === tab.id
                ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-[3px] border-gray-200 dark:border-gray-700" />
            <div className="absolute inset-0 rounded-full border-[3px] border-primary-500 border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Загрузка данных…</p>
        </div>
      ) : activeTab === 'users' ? (

        // ── Users tab ───────────────────────────────────────────────
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={16} />
              <input
                type="text"
                placeholder="Поиск по имени, логину, организации…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-primary-400 dark:focus:border-primary-600 transition-colors"
              />
            </div>
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 active:scale-95 text-white rounded-xl text-sm font-semibold transition-all duration-150 shadow-sm whitespace-nowrap"
            >
              <UserPlus size={15} />
              Добавить
            </button>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <SortTh label="№"            field="id"           sortField={sortField} sortOrder={sortOrder} onSort={handleSort} className="w-12" />
                    <SortTh label="ФИО"          field="name"         sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    <SortTh label="Логин"        field="login"        sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    <SortTh label="Организация"  field="organization" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    <SortTh label="Должность"    field="duty"         sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    <SortTh label="Последний вход" field="last_visit" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/80">
                  {sortedUsers.map((user, idx) => {
                    const badge = getActivityBadge(user.last_visit);
                    return (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
                        <td className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500 tabular-nums">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 bg-gradient-to-br ${AVATAR_COLORS[user.id % AVATAR_COLORS.length]} rounded-lg flex items-center justify-center flex-shrink-0`}>
                              <span className="text-white text-[11px] font-bold">{getInitials(user.name)}</span>
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{user.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono whitespace-nowrap">{user.login}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{user.organization}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{user.duty}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">{user.last_visit || '—'}</span>
                            {badge && (
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${badge.cls}`}>{badge.text}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEdit(user)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all duration-150"
                              title="Редактировать"
                            >
                              <Edit size={15} />
                            </button>
                            <button
                              onClick={() => { setUserToDelete(user.id); setShowDeleteConfirm(true); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all duration-150"
                              title="Удалить"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {sortedUsers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">
                        Пользователи не найдены
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      ) : (

        // ── Activity tab ────────────────────────────────────────────
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <SortTh label="ФИО"           field="name"         sortField={actSortField} sortOrder={actSortOrder} onSort={handleActSort} />
                  <SortTh label="Логин"         field="login"        sortField={actSortField} sortOrder={actSortOrder} onSort={handleActSort} />
                  <SortTh label="Организация"   field="organization" sortField={actSortField} sortOrder={actSortOrder} onSort={handleActSort} />
                  <SortTh label="Должность"     field="duty"         sortField={actSortField} sortOrder={actSortOrder} onSort={handleActSort} />
                  <SortTh label="Последний вход" field="last_visit"  sortField={actSortField} sortOrder={actSortOrder} onSort={handleActSort} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/80">
                {sortedActivities.map((a) => {
                  const badge = getActivityBadge(a.last_visit);
                  return (
                    <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 bg-gradient-to-br ${AVATAR_COLORS[a.id % AVATAR_COLORS.length]} rounded-lg flex items-center justify-center flex-shrink-0`}>
                            <span className="text-white text-[11px] font-bold">{getInitials(a.name)}</span>
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{a.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono whitespace-nowrap">{a.login}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{a.organization}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{a.duty}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">{a.last_visit || '—'}</span>
                          {badge && (
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${badge.cls}`}>{badge.text}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sortedActivities.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">
                      Нет данных об активности
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── User modal ─────────────────────────────────────────────── */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/50 rounded-xl flex items-center justify-center">
                  {editingUser ? <Edit className="w-4 h-4 text-primary-600 dark:text-primary-400" /> : <UserPlus className="w-4 h-4 text-primary-600 dark:text-primary-400" />}
                </div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  {editingUser ? 'Редактировать пользователя' : 'Новый пользователь'}
                </h2>
              </div>
              <button
                onClick={() => setShowUserModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {([
                { label: 'ФИО',   key: 'name',  type: 'text'   },
                { label: 'Логин', key: 'login', type: 'text'   },
              ] as const).map(({ label, key, type }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{label}</label>
                  <input
                    type={type}
                    value={userForm[key]}
                    onChange={e => setUserForm({ ...userForm, [key]: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary-400 dark:focus:border-primary-600 focus:bg-white dark:focus:bg-gray-900 transition-all"
                  />
                </div>
              ))}

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  Пароль {editingUser && <span className="text-gray-400 normal-case font-normal">(пусто = не менять)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={userForm.password}
                    onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full px-3 py-2.5 pr-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary-400 dark:focus:border-primary-600 focus:bg-white dark:focus:bg-gray-900 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {([
                { label: 'Организация', key: 'id_organization', options: organizations },
                { label: 'Должность',   key: 'id_duty',         options: dutys         },
              ] as const).map(({ label, key, options }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{label}</label>
                  <select
                    value={userForm[key]}
                    onChange={e => setUserForm({ ...userForm, [key]: parseInt(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary-400 dark:focus:border-primary-600 focus:bg-white dark:focus:bg-gray-900 transition-all appearance-none"
                  >
                    {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex gap-3 px-6 pb-5">
              <button
                onClick={handleSaveUser}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 hover:bg-primary-700 active:scale-[0.98] text-white rounded-xl text-sm font-semibold transition-all duration-150 shadow-sm"
              >
                <Save size={15} />
                Сохранить
              </button>
              <button
                onClick={() => setShowUserModal(false)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-semibold transition-all duration-150"
              >
                <X size={15} />
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm modal ────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 w-full max-w-sm p-6 animate-slide-up">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-2">Удалить пользователя?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
              Это действие необратимо. Все данные пользователя будут удалены.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteUser}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white rounded-xl text-sm font-semibold transition-all duration-150"
              >
                Удалить
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setUserToDelete(null); }}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-semibold transition-all duration-150"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
