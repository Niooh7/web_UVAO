import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList,
} from 'recharts';
import { Filter, ChevronDown, X, RotateCcw, GitCompare, LineChart } from 'lucide-react';

interface RegionIds { [key: string]: string; }
interface BarChartData {
  district: string;
  reportCount: number;
  baseCount: number;
  regionId: string;
}
interface Filters {
  startDate: string;
  endDate: string;
  problemTopic: string;
  baseStartDate: string;
  baseEndDate: string;
}
interface BarChartDashboardProps {
  regions: RegionIds;
  data: any[];
  baseData?: any[];
  onFiltersChange: (filters: Filters) => void;
  onBaseFiltersChange: (filters: Filters) => void;
  onToggleComparison: (isComparing: boolean) => void;
  showComparison: boolean;
  currentFilters: Filters;
  selectedDistricts: string[];
}

const BarChartDashboard: React.FC<BarChartDashboardProps> = ({
  regions, data, baseData = [], onFiltersChange, onBaseFiltersChange,
  onToggleComparison, showComparison, currentFilters, selectedDistricts,
}) => {
  const [barData, setBarData] = useState<BarChartData[]>([]);
  const [filters, setFilters] = useState<Filters>(currentFilters);
  const [availableProblems, setAvailableProblems] = useState<string[]>([]);
  const [filteredProblems, setFilteredProblems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [activeView, setActiveView] = useState<'report' | 'base' | 'both'>('both');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setFilters(currentFilters); }, [currentFilters]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
        setSearchTerm('');
      }
    };
    if (isDropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isDropdownOpen]);

  useEffect(() => {
    const fetchProblems = async () => {
      try {
        const res = await fetch('/api/chart_filters');
        if (res.ok) {
          const result = await res.json();
          setAvailableProblems(result.problems || []);
          setFilteredProblems(result.problems || []);
        }
      } catch { setAvailableProblems([]); setFilteredProblems([]); }
    };
    fetchProblems();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      setFilteredProblems(availableProblems.filter(p => p.toLowerCase().includes(searchTerm.toLowerCase())));
    } else {
      setFilteredProblems(availableProblems);
    }
  }, [searchTerm, availableProblems]);

  // Process bar data — apply district filter
  useEffect(() => {
    const counts: { [key: string]: { report: number; base: number } } = {};

    const processIssues = (dayData: any[], type: 'report' | 'base') => {
      dayData.forEach(day => {
        day.issues.forEach((issue: any) => {
          const name = issue.region_id;
          if (name && selectedDistricts.includes(name)) {
            const key = Object.keys(regions).find(id => regions[id] === name) || name;
            if (!counts[key]) counts[key] = { report: 0, base: 0 };
            counts[key][type]++;
          }
        });
      });
    };

    processIssues(data, 'report');
    processIssues(baseData, 'base');

    const chartData = Object.entries(counts).map(([k, v]) => ({
      district: regions[k] || k,
      reportCount: v.report,
      baseCount: v.base,
      regionId: k,
    }));
    chartData.sort((a, b) => a.district.localeCompare(b.district, 'ru'));
    setBarData(chartData);
  }, [data, baseData, regions, selectedDistricts]);

  const getTotal = (type: 'report' | 'base' = 'report') =>
    barData.reduce((s, i) => s + (type === 'base' ? i.baseCount : i.reportCount), 0);

  const getDateRange = (type: 'report' | 'base'): string => {
    const dates = type === 'report' ? data : baseData;
    if (type === 'report' && filters.startDate && filters.endDate) {
      return `${new Date(filters.startDate).toLocaleDateString('ru-RU')} — ${new Date(filters.endDate).toLocaleDateString('ru-RU')}`;
    }
    if (type === 'base' && filters.baseStartDate && filters.baseEndDate) {
      return `${new Date(filters.baseStartDate).toLocaleDateString('ru-RU')} — ${new Date(filters.baseEndDate).toLocaleDateString('ru-RU')}`;
    }
    if (dates.length > 0) {
      const ts = dates.map(d => new Date(d.date).getTime());
      return `${new Date(Math.min(...ts)).toLocaleDateString('ru-RU')} — ${new Date(Math.max(...ts)).toLocaleDateString('ru-RU')}`;
    }
    return 'Все время';
  };

  const validateDates = (f: Filters): string => {
    if (f.startDate && f.endDate && new Date(f.startDate) > new Date(f.endDate))
      return 'Дата начала не может быть позже даты окончания';
    if (f.baseStartDate && f.baseEndDate && new Date(f.baseStartDate) > new Date(f.baseEndDate))
      return 'Базовая дата начала не может быть позже даты окончания';
    return '';
  };

  const handleFilterChange = (key: keyof Filters, value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    setValidationError(validateDates(next));
    if (key === 'problemTopic') { setIsDropdownOpen(false); setSearchTerm(''); }
  };

  const handleApply = () => {
    const err = validateDates(filters);
    if (err) { setValidationError(err); return; }
    setValidationError('');
    onFiltersChange(filters);
    if (showComparison && filters.baseStartDate && filters.baseEndDate) {
      onBaseFiltersChange(filters);
    }
  };

  const handleReset = () => {
    const reset: Filters = { startDate: '', endDate: '', problemTopic: '', baseStartDate: '', baseEndDate: '' };
    setFilters(reset);
    setValidationError('');
    setSearchTerm('');
    setIsDropdownOpen(false);
    setActiveView('both');
    onToggleComparison(false);
    onFiltersChange(reset);
  };

  const getMaxDate = () => new Date().toISOString().split('T')[0];
  const hasFilters = !!(filters.startDate || filters.endDate || filters.problemTopic);

  const displayData = barData.map(item => {
    if (activeView === 'report') return { ...item, baseCount: 0 };
    if (activeView === 'base') return { ...item, reportCount: 0 };
    return item;
  });

  const dateInputClass = "px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:border-primary-400 dark:focus:border-primary-500 transition-colors min-w-[140px]";

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 p-5 space-y-5">
      {/* Filter panel */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-50 dark:bg-blue-950/30 rounded-lg flex items-center justify-center">
              <Filter className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Период и проблема</span>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Сбросить
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Дата начала</label>
            <input type="date" value={filters.startDate} max={getMaxDate()} onChange={e => handleFilterChange('startDate', e.target.value)} className={dateInputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">Дата окончания</label>
            <input type="date" value={filters.endDate} max={getMaxDate()} onChange={e => handleFilterChange('endDate', e.target.value)} className={dateInputClass} />
          </div>

          {/* Problem dropdown */}
          <div className="flex flex-col gap-1 relative flex-1 min-w-[200px]" ref={dropdownRef}>
            <label className="text-xs text-gray-500 dark:text-gray-400">Проблема</label>
            <div className="relative">
              <input
                type="text"
                className="w-full px-3 py-2 pr-14 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500 transition-colors cursor-pointer"
                placeholder="Все проблемы"
                value={isDropdownOpen ? searchTerm : (filters.problemTopic || '')}
                onChange={e => { setSearchTerm(e.target.value); if (!isDropdownOpen) setIsDropdownOpen(true); }}
                onFocus={() => setIsDropdownOpen(true)}
                readOnly={!isDropdownOpen}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-0.5">
                {filters.problemTopic && (
                  <button type="button" onClick={e => { e.stopPropagation(); handleFilterChange('problemTopic', ''); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    <X className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                )}
                <button type="button" onClick={() => setIsDropdownOpen(o => !o)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
                <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                  <input
                    type="text"
                    className="w-full px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none text-gray-900 dark:text-white placeholder-gray-400"
                    placeholder="Поиск..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="max-h-52 overflow-y-auto py-1">
                  <button className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors" onClick={() => handleFilterChange('problemTopic', '')}>
                    Все проблемы
                  </button>
                  {filteredProblems.length > 0 ? filteredProblems.map(p => (
                    <button
                      key={p}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors truncate ${
                        filters.problemTopic === p
                          ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 font-medium'
                          : 'text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                      onClick={() => handleFilterChange('problemTopic', p)}
                    >{p}</button>
                  )) : (
                    <p className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">Не найдено</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-transparent select-none">.</label>
            <button type="button" onClick={handleApply} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 active:scale-95 text-white rounded-xl text-sm font-semibold transition-all duration-150 shadow-sm whitespace-nowrap">
              Применить
            </button>
          </div>
        </div>

        {validationError && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-2">{validationError}</p>
        )}
      </div>

      {/* Stats */}
      <div className={`grid gap-3 ${showComparison ? 'grid-cols-2' : 'grid-cols-1 sm:max-w-xs'}`}>
        {showComparison && (
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Предыдущий период</p>
            <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{getTotal('base')}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{getDateRange('base')}</p>
          </div>
        )}
        <div className="px-4 py-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/50">
          <p className="text-xs text-blue-600 dark:text-blue-400 mb-0.5">Отчетный период</p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{getTotal('report')}</p>
          <p className="text-xs text-blue-500 dark:text-blue-500/70 mt-0.5">{getDateRange('report')}</p>
        </div>
      </div>

      {/* Comparison toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => { onToggleComparison(!showComparison); if (showComparison) setActiveView('both'); }}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
            showComparison
              ? 'bg-primary-600 text-white shadow-sm'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <GitCompare className="w-3.5 h-3.5" />
          {showComparison ? 'Скрыть сравнение' : 'Сравнить периоды'}
        </button>
        {showComparison && (
          <>
            {(['base', 'report', 'both'] as const).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setActiveView(v)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  activeView === v
                    ? v === 'base' ? 'bg-gray-600 text-white' : v === 'report' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {v === 'base' ? 'Предыдущий' : v === 'report' ? 'Отчетный' : 'Оба'}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Base period filters */}
      {showComparison && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-3">Предыдущий период для сравнения</p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">Дата начала</label>
              <input type="date" value={filters.baseStartDate} max={getMaxDate()} onChange={e => handleFilterChange('baseStartDate', e.target.value)} className={dateInputClass} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">Дата окончания</label>
              <input type="date" value={filters.baseEndDate} max={getMaxDate()} onChange={e => handleFilterChange('baseEndDate', e.target.value)} className={dateInputClass} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-transparent select-none">.</label>
              <button type="button" onClick={handleApply} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition-colors">
                Применить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      {barData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14">
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-3">
            <LineChart className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Нет данных для отображения</p>
        </div>
      ) : (
        <div className="h-[360px] overflow-x-auto">
          <ResponsiveContainer width="100%" height="100%" minWidth={300}>
            <BarChart data={displayData} margin={{ top: 25, right: 20, left: 0, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
              <XAxis
                dataKey="district"
                angle={-40}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
              />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111827',
                  border: '1px solid #374151',
                  borderRadius: '12px',
                  color: '#f9fafb',
                  fontSize: '12px',
                  padding: '8px 12px',
                }}
                formatter={(value: number, name: string) => [
                  `${value} обращений`,
                  name === 'baseCount' ? 'Предыдущий период' : 'Отчетный период',
                ]}
                labelFormatter={label => `Район: ${label}`}
              />
              <Legend wrapperStyle={{ paddingTop: '8px', fontSize: '12px' }} />
              {activeView !== 'report' && showComparison && (
                <Bar dataKey="baseCount" name="Предыдущий период" fill="#6b7280" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="baseCount" position="top" style={{ fill: '#9ca3af', fontSize: 11 }} />
                </Bar>
              )}
              {activeView !== 'base' && (
                <Bar dataKey="reportCount" name="Отчетный период" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="reportCount" position="top" style={{ fill: '#9ca3af', fontSize: 11 }} />
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default BarChartDashboard;
