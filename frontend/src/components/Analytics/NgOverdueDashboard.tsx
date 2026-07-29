import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ListChecks, AlertCircle, Search, X,
  ArrowUp, ArrowDown, ChevronsUpDown, Download, CalendarDays, GitCompare,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList, Customized,
} from 'recharts';
import { User } from '../../types';

interface NgOverdueDashboardProps { user: User; }

interface NgIssue {
  id: string;
  publishDate: string | null;
  district: string | null;
  deadline: string | null;
  preparationStatus: string | null;
  address: string | null;
  problem: string | null;
  monitorOverdue: string;
  day: string;
  status: string;
  exportDate: string | null;
}

const ALL_DISTRICTS = [
  'АВД ЮВАО', 'Выхино-Жулебино', 'Капотня', 'Кузьминки', 'Лефортово',
  'Люблино', 'Марьино', 'Некрасовка', 'Нижегородский', 'Печатники',
  'Рязанский', 'Текстильщики', 'Южнопортовый',
];

const ngLink = (id: string) => `https://er.mos.ru/ker/admin/issues/view-common?id=${id}&section=all`;
const todayStr = () => new Date().toISOString().split('T')[0];

const inputCls = "px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:border-primary-400 dark:focus:border-primary-500 transition-colors";

// ─── Компонент стрелок для режима сравнения ──────────────────────────────────
const ComparisonArrows: React.FC<any> = ({ formattedGraphicalItems }) => {
  if (!formattedGraphicalItems || formattedGraphicalItems.length < 2) return null;
  const mainItem = formattedGraphicalItems.find((i: any) => i.props?.dataKey === 'Основной период');
  const cmpItem = formattedGraphicalItems.find((i: any) => i.props?.dataKey === 'Сравнение');
  if (!mainItem?.props?.data || !cmpItem?.props?.data) return null;

  return (
    <g>
      {mainItem.props.data.map((mainBar: any, i: number) => {
        const cmpBar = cmpItem.props.data[i];
        if (!mainBar || !cmpBar) return null;
        const mainVal: number = mainBar.value ?? 0;
        const cmpVal: number = cmpBar.value ?? 0;
        const diff = cmpVal - mainVal;
        if (diff === 0) return null;

        const isUp = diff > 0;
        const color = isUp ? '#ef4444' : '#22c55e';
        const bgColor = isUp ? '#fee2e2' : '#dcfce7';
        const symbol = isUp ? '↑' : '↓';
        const label = `${symbol}${Math.abs(diff)}`;
        const tw = Math.max(label.length * 7, 26);

        const midX = (mainBar.x + mainBar.width / 2 + cmpBar.x + cmpBar.width / 2) / 2;
        const topY = Math.min(mainBar.y ?? 0, cmpBar.y ?? 0) - 4;

        return (
          <g key={i}>
            <rect x={midX - tw / 2 - 3} y={topY - 15} width={tw + 6} height={14} rx={4} fill={bgColor} />
            <text x={midX} y={topY - 4} textAnchor="middle" fontSize={10} fill={color} fontWeight="bold">
              {label}
            </text>
          </g>
        );
      })}
    </g>
  );
};

// ─── Лейбл суммы на вершине сложенных столбиков ──────────────────────────────
const TotalLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (!value) return null;
  return (
    <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#374151" className="dark:fill-gray-300">
      {value}
    </text>
  );
};

function NgOverdueDashboard({ user }: NgOverdueDashboardProps) {
  const [issues, setIssues] = useState<NgIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>(ALL_DISTRICTS);
  const [idSearch, setIdSearch] = useState('');
  const [exportDateFrom, setExportDateFrom] = useState(todayStr);
  const [exportDateTo, setExportDateTo] = useState(todayStr);
  const [compareMode, setCompareMode] = useState(false);
  const [compareDateFrom, setCompareDateFrom] = useState('');
  const [compareDateTo, setCompareDateTo] = useState('');
  const [showOnlyUrgent, setShowOnlyUrgent] = useState(false);
  const [sortField, setSortField] = useState<keyof NgIssue>('deadline');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const fetchData = () => {
    fetch('/api/ng_overdue')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: NgIssue[]) => { setIssues(data); setError(null); })
      .catch(e => setError(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); const t = setInterval(fetchData, 60000); return () => clearInterval(t); }, []);

  const isAllSelected = selectedDistricts.length === ALL_DISTRICTS.length;
  const hasDateFilter = !!(exportDateFrom || exportDateTo);

  const toggleDistrict = (d: string) => {
    if (isAllSelected) { setSelectedDistricts([d]); }
    else if (selectedDistricts.includes(d)) {
      const next = selectedDistricts.filter(x => x !== d);
      setSelectedDistricts(next.length === 0 ? ALL_DISTRICTS : next);
    } else {
      const next = [...selectedDistricts, d];
      setSelectedDistricts(next.length === ALL_DISTRICTS.length ? ALL_DISTRICTS : next);
    }
    setCurrentPage(1);
  };

  // ── Фильтрация таблицы (основной период) ─────────────────────────────────
  const filteredIssues = useMemo(() => {
    let r = issues.filter(i => !i.district || selectedDistricts.includes(i.district));
    if (idSearch.trim()) {
      const t = idSearch.trim().toLowerCase();
      r = r.filter(i => i.id.toLowerCase().includes(t));
    }
    if (exportDateFrom) r = r.filter(i => i.exportDate ? i.exportDate.slice(0, 10) >= exportDateFrom : false);
    if (exportDateTo)   r = r.filter(i => i.exportDate ? i.exportDate.slice(0, 10) <= exportDateTo   : false);
    if (showOnlyUrgent) r = r.filter(i => i.day === 'Просрок' || ['6 день', '7 день', '8 день'].includes(i.day));
    return r;
  }, [issues, selectedDistricts, idSearch, exportDateFrom, exportDateTo, showOnlyUrgent]);

  // ── Фильтрация для периода сравнения (для графика) ────────────────────────
  const compareIssues = useMemo(() => {
    if (!compareMode || !compareDateFrom || !compareDateTo) return [];
    let r = issues.filter(i => !i.district || selectedDistricts.includes(i.district));
    r = r.filter(i => i.exportDate ? i.exportDate.slice(0, 10) >= compareDateFrom : false);
    r = r.filter(i => i.exportDate ? i.exportDate.slice(0, 10) <= compareDateTo   : false);
    return r;
  }, [issues, selectedDistricts, compareMode, compareDateFrom, compareDateTo]);

  // ── Данные для графика ────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const active = filteredIssues.filter(i => i.status !== 'Устранено');

    if (compareMode && compareIssues.length > 0) {
      const cmpActive = compareIssues.filter(i => i.status !== 'Устранено');
      return ALL_DISTRICTS
        .filter(d => selectedDistricts.includes(d))
        .map(d => ({
          name: d,
          'Основной период': active.filter(i => i.district === d).length,
          'Сравнение': cmpActive.filter(i => i.district === d).length,
        }))
        .filter(d => d['Основной период'] > 0 || d['Сравнение'] > 0);
    }

    return ALL_DISTRICTS
      .filter(d => selectedDistricts.includes(d))
      .map(d => {
        const di = active.filter(i => i.district === d);
        const p  = di.filter(i => i.day === 'Просрок').length;
        const u  = di.filter(i => ['6 день', '7 день', '8 день'].includes(i.day)).length;
        const n  = di.filter(i => ['1 день', '2 день', '3 день', '4 день', '5 день'].includes(i.day)).length;
        return { name: d, 'Просрок': p, '6–8 день': u, '1–5 день': n, total: p + u + n, _lbl: 0 };
      })
      .filter(d => d.total > 0);
  }, [filteredIssues, compareIssues, selectedDistricts, compareMode]);

  // ── Сортировка и пагинация ────────────────────────────────────────────────
  const sortedIssues = useMemo(() => {
    return [...filteredIssues].sort((a, b) => {
      const av = String(a[sortField] ?? ''), bv = String(b[sortField] ?? '');
      if (['deadline', 'publishDate', 'exportDate'].includes(sortField as string)) {
        const d = new Date(av).getTime() - new Date(bv).getTime();
        return sortDir === 'asc' ? d : -d;
      }
      const c = av.localeCompare(bv, 'ru');
      return sortDir === 'asc' ? c : -c;
    });
  }, [filteredIssues, sortField, sortDir]);

  const totalPages = Math.ceil(sortedIssues.length / ITEMS_PER_PAGE);
  const paginatedIssues = useMemo(() => {
    const s = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedIssues.slice(s, s + ITEMS_PER_PAGE);
  }, [sortedIssues, currentPage]);

  const handleSort = (f: keyof NgIssue) => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDir('asc'); }
    setCurrentPage(1);
  };

  // ── Excel export URL с текущими фильтрами ────────────────────────────────
  const buildExportUrl = () => {
    const p = new URLSearchParams();
    if (exportDateFrom) p.set('export_date_from', exportDateFrom);
    if (exportDateTo)   p.set('export_date_to', exportDateTo);
    if (!isAllSelected) p.set('districts', selectedDistricts.join(','));
    if (idSearch.trim()) p.set('search', idSearch.trim());
    if (showOnlyUrgent) p.set('urgent_only', '1');
    return `/api/ng_overdue/export?${p}`;
  };

  function SortIcon({ field }: { field: keyof NgIssue }) {
    if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 text-gray-400 opacity-60" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-primary-500" /> : <ArrowDown className="w-3 h-3 text-primary-500" />;
  }

  const rowClass = (day: string) => {
    if (day === 'Просрок') return 'bg-red-100/70 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/40';
    if (['8 день', '7 день', '6 день'].includes(day)) return 'bg-red-50/80 dark:bg-red-950/15 hover:bg-red-50 dark:hover:bg-red-950/25';
    return 'hover:bg-gray-50/60 dark:hover:bg-gray-800/30';
  };

  const formatDate = (v: string | null) => {
    if (!v) return '—';
    const d = new Date(v);
    return isNaN(d.getTime()) ? v : d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const thCls = "px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none whitespace-nowrap";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-[3px] border-gray-200 dark:border-gray-700" />
          <div className="absolute inset-0 rounded-full border-[3px] border-primary-500 border-t-transparent animate-spin" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Загрузка данных…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 px-4 py-3 bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-100 dark:border-red-900/50">
        <div className="w-7 h-7 bg-red-100 dark:bg-red-900/60 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
          <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
        </div>
        <p className="text-sm text-red-700 dark:text-red-300">Ошибка загрузки: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Заголовок ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Link to="/" className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 flex-shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-violet-700 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
          <ListChecks className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">Дашборд НГ</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Сообщения в работе — обновление каждый час</p>
        </div>
      </div>

      {/* ── Фильтры ───────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 p-5 space-y-4">

        {/* Районы */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Фильтр по районам</span>
              {!isAllSelected && (
                <span className="text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/30 px-2 py-0.5 rounded-full">
                  {selectedDistricts.length} из {ALL_DISTRICTS.length}
                </span>
              )}
            </div>
            {!isAllSelected && (
              <button type="button" onClick={() => { setSelectedDistricts(ALL_DISTRICTS); setCurrentPage(1); }} className="text-xs text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                Сбросить
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setSelectedDistricts(ALL_DISTRICTS); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${isAllSelected ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
              Все
            </button>
            {ALL_DISTRICTS.map(d => (
              <button key={d} type="button" onClick={() => toggleDistrict(d)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                  !isAllSelected && selectedDistricts.includes(d) ? 'bg-primary-600 text-white shadow-sm'
                  : !isAllSelected ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-primary-50 dark:hover:bg-primary-950/20 hover:text-primary-700 dark:hover:text-primary-300'
                }`}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Период выгрузки */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white flex-shrink-0">
              <CalendarDays className="w-4 h-4 text-gray-400" />
              Период выгрузки
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">с</span>
              <input type="date" value={exportDateFrom} onChange={e => { setExportDateFrom(e.target.value); setCurrentPage(1); }} className={inputCls} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">по</span>
              <input type="date" value={exportDateTo} onChange={e => { setExportDateTo(e.target.value); setCurrentPage(1); }} className={inputCls} />
            </div>
            {hasDateFilter && (
              <button type="button" onClick={() => { setExportDateFrom(''); setExportDateTo(''); setCurrentPage(1); }}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                <X className="w-3.5 h-3.5" /> Сбросить
              </button>
            )}

            {/* Кнопка сравнения */}
            <button type="button" onClick={() => { setCompareMode(m => !m); if (compareMode) { setCompareDateFrom(''); setCompareDateTo(''); } }}
              className={`ml-2 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                compareMode ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-primary-50 dark:hover:bg-primary-950/20 hover:text-primary-700'
              }`}>
              <GitCompare className="w-3.5 h-3.5" />
              Сравнить
            </button>
          </div>

          {/* Период сравнения */}
          {compareMode && (
            <div className="flex flex-wrap items-center gap-3 mt-3 pl-6 border-l-2 border-primary-300 dark:border-primary-700">
              <span className="text-xs font-medium text-primary-600 dark:text-primary-400">Период для сравнения:</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">с</span>
                <input type="date" value={compareDateFrom} onChange={e => setCompareDateFrom(e.target.value)} className={inputCls} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">по</span>
                <input type="date" value={compareDateTo} onChange={e => setCompareDateTo(e.target.value)} className={inputCls} />
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-gray-400" /> Основной период</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-blue-400" /> Сравнение</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Столбчатая диаграмма ──────────────────────────────────────────── */}
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 p-5">
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Сообщения в работе по районам
            {compareMode && compareIssues.length > 0 && <span className="ml-2 text-xs font-normal text-gray-400">(сравнение периодов)</span>}
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 28, right: 20, left: 0, bottom: 100 }} barCategoryGap="30%" barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.2)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: 'currentColor' }}
                className="text-gray-500 dark:text-gray-400"
                angle={-40}
                textAnchor="end"
                interval={0}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: 'currentColor' }}
                className="text-gray-400 dark:text-gray-500"
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid rgba(156,163,175,0.3)', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                cursor={{ fill: 'rgba(156,163,175,0.08)' }}
              />
              <Legend
                verticalAlign="bottom"
                wrapperStyle={{ fontSize: '11px', paddingTop: '28px' }}
                iconType="circle"
                iconSize={8}
              />

              {compareMode ? (
                <>
                  <Bar dataKey="Основной период" fill="#9ca3af" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="Основной период" position="top" style={{ fontSize: 10, fontWeight: 'bold', fill: '#6b7280' }} />
                  </Bar>
                  <Bar dataKey="Сравнение" fill="#60a5fa" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="Сравнение" position="top" style={{ fontSize: 10, fontWeight: 'bold', fill: '#3b82f6' }} />
                  </Bar>
                  <Customized component={ComparisonArrows} />
                </>
              ) : (
                <>
                  <Bar dataKey="Просрок" stackId="a" fill="#fca5a5" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="6–8 день" stackId="a" fill="#fdba74" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="1–5 день" stackId="a" fill="#93c5fd" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="_lbl" stackId="a" fill="transparent" isAnimationActive={false}>
                    <LabelList dataKey="total" content={TotalLabel} />
                  </Bar>
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Таблица ───────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <p className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap flex-grow">Сообщения «Наш Город»</p>
          <button
            type="button"
            onClick={() => { setShowOnlyUrgent(v => !v); setCurrentPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-colors flex-shrink-0 ${
              showOnlyUrgent
                ? 'bg-red-600 text-white border-red-600 shadow-sm'
                : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-950/40'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-current inline-block" />
            Только срочные
          </button>
          <a href={buildExportUrl()} download
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-900/50 rounded-xl transition-colors flex-shrink-0">
            <Download className="w-3.5 h-3.5" /> Выгрузить Excel
          </a>
          <div className="relative flex-shrink-0 w-full sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input type="text" value={idSearch} onChange={e => { setIdSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Поиск по номеру…"
              className="w-full pl-9 pr-8 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-primary-400 transition-colors" />
            {idSearch && (
              <button type="button" onClick={() => { setIdSearch(''); setCurrentPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap flex-shrink-0">
            <span className="font-semibold">{sortedIssues.length}</span> сообщений
          </span>
        </div>

        {sortedIssues.length === 0 ? (
          <div className="p-10 flex flex-col items-center justify-center">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-3">
              <Search className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Нет данных для отображения</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1300px]">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className={thCls} onClick={() => handleSort('id')}><div className="flex items-center gap-1.5">Номер сообщения <SortIcon field="id" /></div></th>
                    <th className={thCls} onClick={() => handleSort('day')}><div className="flex items-center gap-1.5">День <SortIcon field="day" /></div></th>
                    <th className={thCls} onClick={() => handleSort('status')}><div className="flex items-center gap-1.5">Статус <SortIcon field="status" /></div></th>
                    <th className={thCls} onClick={() => handleSort('exportDate')}><div className="flex items-center gap-1.5">Дата выгрузки <SortIcon field="exportDate" /></div></th>
                    <th className={thCls} onClick={() => handleSort('publishDate')}><div className="flex items-center gap-1.5">Дата публикации <SortIcon field="publishDate" /></div></th>
                    <th className={thCls} onClick={() => handleSort('district')}><div className="flex items-center gap-1.5">Район <SortIcon field="district" /></div></th>
                    <th className={thCls} onClick={() => handleSort('deadline')}><div className="flex items-center gap-1.5">Регл. срок (Портал) <SortIcon field="deadline" /></div></th>
                    <th className={thCls} onClick={() => handleSort('preparationStatus')}><div className="flex items-center gap-1.5">Статус ответа <SortIcon field="preparationStatus" /></div></th>
                    <th className={thCls}>Адрес</th>
                    <th className={thCls}>Проблемная тема</th>
                    <th className={thCls}>Просрок (Монитор)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
                  {paginatedIssues.map((issue, idx) => (
                    <tr key={`${issue.id}-${idx}`} className={`transition-colors ${rowClass(issue.day)}`}>
                      <td className="px-4 py-3 font-mono text-xs">
                        <a href={ngLink(issue.id)} target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline font-semibold">{issue.id}</a>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${
                          issue.day === 'Просрок' ? 'bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-300'
                          : ['8 день','7 день','6 день'].includes(issue.day) ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}>{issue.day}</span>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${
                          issue.status === 'Устранено' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                        }`}>{issue.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs">{formatDate(issue.exportDate)}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs">{formatDate(issue.publishDate)}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs">{issue.district || '—'}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs">{formatDate(issue.deadline)}</td>
                      <td className="px-4 py-3 text-xs max-w-[180px]">
                        {issue.status === 'Устранено'
                          ? <span className="text-emerald-700 dark:text-emerald-400 font-medium">Опубликовано</span>
                          : <span className="text-gray-700 dark:text-gray-300 truncate block" title={issue.preparationStatus || ''}>{issue.preparationStatus || '—'}</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[220px]"><span className="text-gray-700 dark:text-gray-300 truncate block" title={issue.address || ''}>{issue.address || '—'}</span></td>
                      <td className="px-4 py-3 text-xs max-w-[200px]"><span className="text-gray-700 dark:text-gray-300 truncate block" title={issue.problem || ''}>{issue.problem || '—'}</span></td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">{issue.monitorOverdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, sortedIssues.length)} из {sortedIssues.length}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">←</button>
                  <span className="px-2 text-xs text-gray-500 dark:text-gray-400">{currentPage} / {totalPages}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">→</button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-200 dark:bg-red-900/60 inline-block" />Просрочено</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-100 dark:bg-red-950/40 inline-block" />Срочно (6–8 день)</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />В работе</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Устранено</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default NgOverdueDashboard;
