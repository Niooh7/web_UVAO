import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Download, BarChart3, Search, X,
  TrendingUp, ChevronLeft, ChevronRight, AlertCircle, RefreshCw,
  ChevronsUpDown, ArrowUp, ArrowDown,
} from 'lucide-react';

interface TransferData {
  district: string;
  botTransfers: number;
  ngTransfers: number;
  transferPercentage: number;
  totalTransfers: number;
}

interface RawData {
  id: string;
  district: string;
  type: string;
  dateAnswer: string;
  dateCreated?: string;
  transferType: 'bot' | 'ng';
}

type SortKey = 'district' | 'botTransfers' | 'ngTransfers' | 'transferPercentage';
type SortDir = 'asc' | 'desc';

const ALL_DISTRICTS = [
  'АВД ЮВАО', 'Выхино-Жулебино', 'Капотня', 'Кузьминки', 'Лефортово',
  'Люблино', 'Марьино', 'Некрасовка', 'Нижегородский', 'Печатники',
  'Рязанский', 'Текстильщики', 'Южнопортовый',
];

const ITEMS_PER_PAGE = 15;

function formatDate(dateString: string, includeTime = false): string {
  if (!dateString || dateString === 'Не указана') return '—';
  try {
    let date: Date;
    if (dateString.includes('-') && dateString.includes(':')) {
      date = new Date(dateString);
    } else if (dateString.includes('-')) {
      date = new Date(dateString + 'T00:00:00');
    } else if (dateString.includes('.')) {
      const [day, month, year] = dateString.split('.').map(Number);
      date = new Date(year, month - 1, day);
    } else {
      return dateString;
    }
    if (includeTime && dateString.includes(':')) {
      return date.toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    }
    return date.toLocaleDateString('ru-RU');
  } catch {
    return dateString;
  }
}

function getBarColor(pct: number, hasNg: boolean, hasBot: boolean): string {
  if (!hasNg && !hasBot) return 'bg-gray-300 dark:bg-gray-600';
  if (!hasNg && hasBot) return 'bg-purple-500';
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 60) return 'bg-blue-500';
  if (pct >= 40) return 'bg-amber-500';
  if (pct >= 20) return 'bg-orange-500';
  return 'bg-red-500';
}

function getPercentageCls(pct: number, hasNg: boolean, hasBot: boolean): string {
  if (!hasNg && !hasBot) return 'text-gray-400 dark:text-gray-500';
  if (!hasNg && hasBot) return 'text-purple-600 dark:text-purple-400';
  if (pct >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 60) return 'text-blue-600 dark:text-blue-400';
  if (pct >= 40) return 'text-amber-600 dark:text-amber-500';
  if (pct >= 20) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3.5 h-3.5 text-gray-400" />;
  return sortDir === 'asc'
    ? <ArrowUp className="w-3.5 h-3.5 text-primary-600" />
    : <ArrowDown className="w-3.5 h-3.5 text-primary-600" />;
}

function getPageNumbers(current: number, total: number): (number | 'e')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | 'e')[] = [1];
  if (current > 3) pages.push('e');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push('e');
  pages.push(total);
  return pages;
}

function TransferStatisticsReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [transferData, setTransferData] = useState<TransferData[]>([]);
  const [rawData, setRawData] = useState<RawData[]>([]);
  const [activeTab, setActiveTab] = useState<'bot' | 'ng'>('bot');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [idSearch, setIdSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('transferPercentage');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>(ALL_DISTRICTS);

  useEffect(() => {
    const today = new Date();
    const mon = new Date(today);
    mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    setStartDate(mon.toISOString().split('T')[0]);
    setEndDate(sun.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (startDate && endDate) fetchData();
  }, [startDate, endDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, idSearch, selectedDistricts]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(`/api/transfer-statistics?start_date=${startDate}&end_date=${endDate}`);
      if (!resp.ok) throw new Error();
      const data = await resp.json();
      setTransferData(data.summary || []);
      setRawData(data.rawData || []);
    } catch {
      setError('Не удалось загрузить данные. Проверьте соединение с сервером.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'summary' | 'bot' | 'ng') => {
    try {
      const resp = await fetch(
        `/api/transfer-statistics/export?start_date=${startDate}&end_date=${endDate}&type=${type}`
      );
      if (!resp.ok) return;
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `переносы_${type}_${startDate}_${endDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch { /* ignore */ }
  };

  const isAllSelected = selectedDistricts.length === ALL_DISTRICTS.length;

  const toggleDistrict = (district: string) => {
    if (isAllSelected) {
      setSelectedDistricts([district]);
    } else if (selectedDistricts.includes(district)) {
      const next = selectedDistricts.filter(d => d !== district);
      setSelectedDistricts(next.length === 0 ? ALL_DISTRICTS : next);
    } else {
      const next = [...selectedDistricts, district];
      setSelectedDistricts(next.length === ALL_DISTRICTS.length ? ALL_DISTRICTS : next);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedSummary = useMemo(() => {
    const filtered = transferData.filter(d => selectedDistricts.includes(d.district));
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv, 'ru') : bv.localeCompare(av, 'ru');
      }
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return 0;
    });
  }, [transferData, selectedDistricts, sortKey, sortDir]);

  const filteredRaw = useMemo(() => {
    return rawData
      .filter(r => r.transferType === activeTab)
      .filter(r => selectedDistricts.includes(r.district))
      .filter(r => !idSearch.trim() || r.id.toLowerCase().includes(idSearch.trim().toLowerCase()));
  }, [rawData, activeTab, selectedDistricts, idSearch]);

  const totalPages = Math.ceil(filteredRaw.length / ITEMS_PER_PAGE);
  const paginatedRaw = filteredRaw.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const totals = useMemo(() => {
    const f = transferData.filter(d => selectedDistricts.includes(d.district));
    const bot = f.reduce((s, d) => s + d.botTransfers, 0);
    const ng = f.reduce((s, d) => s + d.ngTransfers, 0);
    const pct = ng > 0 ? Math.round((bot / ng) * 100) : null;
    return { bot, ng, total: bot + ng, pct };
  }, [transferData, selectedDistricts]);

  const dateInputClass =
    'w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 dark:text-white';
  const thCls =
    'px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider';

  const hasData = !loading && transferData.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-6 px-4">
      <div className="max-w-7xl mx-auto space-y-5 animate-fade-in">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 flex-shrink-0"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-violet-700 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
              Статистика переносов
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Сравнение переносов через бота и портал НГ по районам
            </p>
          </div>
        </div>

        {/* Date range */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Дата начала
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className={dateInputClass}
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Дата окончания
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className={dateInputClass}
              />
            </div>
            <button
              onClick={fetchData}
              disabled={!startDate || !endDate || loading}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Загрузка…' : 'Обновить'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 px-4 py-3 bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-100 dark:border-red-900/50">
            <div className="w-7 h-7 bg-red-100 dark:bg-red-900/60 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border-[3px] border-gray-200 dark:border-gray-700" />
              <div className="absolute inset-0 rounded-full border-[3px] border-primary-500 border-t-transparent animate-spin" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Загрузка данных…</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && transferData.length === 0 && startDate && endDate && (
          <div className="flex flex-col items-center justify-center min-h-[240px] gap-3">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Нет данных за выбранный период
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Попробуйте изменить диапазон дат
            </p>
          </div>
        )}

        {hasData && (
          <>
            {/* Summary metric cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 p-4 col-span-2 lg:col-span-1">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">% через бота</p>
                <p className={`text-3xl font-bold ${
                  totals.pct === null ? 'text-gray-400' :
                  totals.pct >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                  totals.pct >= 60 ? 'text-blue-600 dark:text-blue-400' :
                  totals.pct >= 40 ? 'text-amber-600 dark:text-amber-500' : 'text-red-600 dark:text-red-400'
                }`}>
                  {totals.pct !== null ? `${totals.pct}%` : '—'}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">от переносов портала НГ</p>
                {totals.pct !== null && (
                  <div className="mt-2.5 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        totals.pct >= 80 ? 'bg-emerald-500' :
                        totals.pct >= 60 ? 'bg-blue-500' :
                        totals.pct >= 40 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(totals.pct, 100)}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 p-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Всего</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{totals.total}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">бот + НГ вместе</p>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 p-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Через бота</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totals.bot}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">одобрено модератором</p>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 p-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Через НГ</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{totals.ng}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">портальные переносы</p>
              </div>
            </div>

            {/* District filter */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    Фильтр по районам
                  </span>
                  {!isAllSelected && (
                    <span className="text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/30 px-2 py-0.5 rounded-full">
                      {selectedDistricts.length} из {ALL_DISTRICTS.length}
                    </span>
                  )}
                </div>
                {!isAllSelected && (
                  <button
                    type="button"
                    onClick={() => setSelectedDistricts(ALL_DISTRICTS)}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  >
                    Сбросить
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDistricts(ALL_DISTRICTS)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                    isAllSelected
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  Все
                </button>
                {ALL_DISTRICTS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDistrict(d)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                      !isAllSelected && selectedDistricts.includes(d)
                        ? 'bg-primary-600 text-white shadow-sm'
                        : !isAllSelected
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-primary-50 dark:hover:bg-primary-950/20 hover:text-primary-700 dark:hover:text-primary-300'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary table with progress bars */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800/80">
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                    Сводная статистика по районам
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {startDate && endDate
                      ? `${formatDate(startDate)} — ${formatDate(endDate)} · `
                      : ''}
                    {sortedSummary.length}{' '}
                    {sortedSummary.length === 1
                      ? 'район'
                      : sortedSummary.length <= 4
                      ? 'района'
                      : 'районов'}
                  </p>
                </div>
                <button
                  onClick={() => handleExport('summary')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Экспорт
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50">
                      <th className={thCls}>
                        <button
                          onClick={() => handleSort('district')}
                          className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                        >
                          Район <SortIcon col="district" sortKey={sortKey} sortDir={sortDir} />
                        </button>
                      </th>
                      <th className={thCls}>
                        <button
                          onClick={() => handleSort('botTransfers')}
                          className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                        >
                          Бот <SortIcon col="botTransfers" sortKey={sortKey} sortDir={sortDir} />
                        </button>
                      </th>
                      <th className={thCls}>
                        <button
                          onClick={() => handleSort('ngTransfers')}
                          className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                        >
                          НГ <SortIcon col="ngTransfers" sortKey={sortKey} sortDir={sortDir} />
                        </button>
                      </th>
                      <th className={`${thCls} w-56`}>
                        <button
                          onClick={() => handleSort('transferPercentage')}
                          className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                        >
                          % через бота{' '}
                          <SortIcon col="transferPercentage" sortKey={sortKey} sortDir={sortDir} />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                    {sortedSummary.map((item, i) => {
                      const hasNg = item.ngTransfers > 0;
                      const hasBot = item.botTransfers > 0;
                      const barPct = !hasNg && hasBot ? 100 : !hasNg ? 0 : Math.min(item.transferPercentage, 100);
                      const pctText =
                        !hasNg && !hasBot ? '—' :
                        !hasNg && hasBot ? '100%+' :
                        `${item.transferPercentage}%`;
                      const pctCls = getPercentageCls(item.transferPercentage, hasNg, hasBot);
                      const barColor = getBarColor(item.transferPercentage, hasNg, hasBot);
                      return (
                        <tr
                          key={i}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {item.district}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                            {item.botTransfers}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-purple-600 dark:text-purple-400">
                            {item.ngTransfers}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden min-w-[80px]">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                  style={{ width: `${barPct}%` }}
                                />
                              </div>
                              <span className={`text-sm font-semibold min-w-[52px] text-right ${pctCls}`}>
                                {pctText}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {sortedSummary.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500"
                        >
                          Нет данных для выбранных районов
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Color legend */}
              <div className="px-5 py-3 border-t border-gray-50 dark:border-gray-800/50 flex flex-wrap gap-x-5 gap-y-2">
                {[
                  { cls: 'bg-emerald-500', label: '≥ 80% — отлично' },
                  { cls: 'bg-blue-500', label: '60–79% — хорошо' },
                  { cls: 'bg-amber-500', label: '40–59% — средне' },
                  { cls: 'bg-orange-500', label: '20–39% — плохо' },
                  { cls: 'bg-red-500', label: '< 20% — очень плохо' },
                  { cls: 'bg-purple-500', label: 'только бот (НГ нет)' },
                ].map(({ cls, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cls}`} />
                    <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Detailed records */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800/80 space-y-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                      Детальные записи
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {filteredRaw.length} записей
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Поиск по ID…"
                        value={idSearch}
                        onChange={e => { setIdSearch(e.target.value); setCurrentPage(1); }}
                        className="pl-8 pr-7 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 dark:text-white w-40"
                      />
                      {idSearch && (
                        <button
                          onClick={() => setIdSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => handleExport(activeTab)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Экспорт
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1.5">
                  {(['bot', 'ng'] as const).map(tab => {
                    const count = rawData
                      .filter(r => r.transferType === tab && selectedDistricts.includes(r.district))
                      .length;
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                          activeTab === tab
                            ? tab === 'bot'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-purple-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {tab === 'bot' ? 'Через бота' : 'Через НГ'}
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                            activeTab === tab
                              ? 'bg-white/20 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50">
                      <th className={thCls}>ID</th>
                      <th className={thCls}>Район</th>
                      <th className={thCls}>Тип</th>
                      <th className={thCls}>Дата переноса</th>
                      <th className={thCls}>Дата создания</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                    {paginatedRaw.map(item => (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                      >
                        <td className="px-4 py-3 text-xs font-mono text-gray-500 dark:text-gray-400">
                          {item.id}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                          {item.district}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                          {item.type || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                          {formatDate(item.dateAnswer)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                          {formatDate(item.dateCreated || '', item.transferType === 'bot')}
                        </td>
                      </tr>
                    ))}
                    {paginatedRaw.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500"
                        >
                          {idSearch
                            ? `Нет записей с ID «${idSearch}»`
                            : 'Нет данных для отображения'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50 dark:border-gray-800/50">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredRaw.length)} из {filteredRaw.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {getPageNumbers(currentPage, totalPages).map((p, i) =>
                      p === 'e' ? (
                        <span key={`e${i}`} className="px-1 text-xs text-gray-400">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p)}
                          className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${
                            currentPage === p
                              ? 'bg-primary-600 text-white'
                              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex items-start gap-3 px-4 py-3.5 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900/50">
              <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900/60 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <BarChart3 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <p>
                  <span className="font-semibold">Формула:</span> % = (переносы через бота ÷ переносы через НГ) × 100
                </p>
                <p>
                  <span className="font-semibold">Бот</span> — заявки со статусом «Одобрено окончательно (модератор 1)» из базы бота.
                </p>
                <p>
                  <span className="font-semibold">НГ</span> — переносы из таблицы delays_ng портала НГ за выбранный период.
                </p>
                <p className="text-blue-500 dark:text-blue-400">
                  Данные обновляются каждое воскресенье в 23:20.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default TransferStatisticsReport;
