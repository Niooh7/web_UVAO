import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, LineChart, AlertCircle } from 'lucide-react';
import BarChartDashboard from './BarChartDashboard';
import DetailedIssuesTable from './DetailedIssuesTable';
import { User } from '../../types';
import { fetchWithAuth } from '../../utils/api';

interface RegionIds { [key: string]: string; }
interface DashboardProps { user: User; }
interface Filters {
  startDate: string;
  endDate: string;
  problemTopic: string;
  baseStartDate: string;
  baseEndDate: string;
}

const REGION_IDS: RegionIds = {
  "104": "Выхино-Жулебино",
  "87": "Капотня",
  "22": "Кузьминки",
  "21": "Лефортово",
  "89": "Люблино",
  "5": "Марьино",
  "71": "Некрасовка",
  "34": "Нижегородский",
  "41": "Печатники",
  "124": "Рязанский",
  "53": "Текстильщики",
  "105": "Южнопортовый",
  "АВД ЮВАО": "АВД ЮВАО",
  "Выхино-Жулебино": "Выхино-Жулебино",
  "Капотня": "Капотня",
  "Кузьминки": "Кузьминки",
  "Лефортово": "Лефортово",
  "Люблино": "Люблино",
  "Марьино": "Марьино",
  "Некрасовка": "Некрасовка",
  "Нижегородский": "Нижегородский",
  "Печатники": "Печатники",
  "Рязанский": "Рязанский",
  "Текстильщики": "Текстильщики",
  "Южнопортовый": "Южнопортовый",
};

const ALL_DISTRICTS = [
  'АВД ЮВАО', 'Выхино-Жулебино', 'Капотня', 'Кузьминки', 'Лефортово',
  'Люблино', 'Марьино', 'Некрасовка', 'Нижегородский', 'Печатники',
  'Рязанский', 'Текстильщики', 'Южнопортовый',
];

function Dashboard({ user }: DashboardProps) {
  const [reportData, setReportData] = useState<any[]>([]);
  const [baseData, setBaseData] = useState<any[]>([]);
  const [filters, setFilters] = useState<Filters>({
    startDate: '', endDate: '', problemTopic: '', baseStartDate: '', baseEndDate: '',
  });
  const [showComparison, setShowComparison] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = !!user.is_admin;
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>(ALL_DISTRICTS);
  const [overdueOnly, setOverdueOnly] = useState(false);

  const fetchReportData = async (currentFilters: Filters, onlyOverdue = overdueOnly) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (currentFilters.startDate) params.append('start_date', currentFilters.startDate);
      if (currentFilters.endDate) params.append('end_date', currentFilters.endDate);
      if (currentFilters.problemTopic) params.append('problem_topic', currentFilters.problemTopic);
      if (onlyOverdue) params.append('overdue_only', 'true');
      const response = await fetch(`/api/chart_data?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setReportData(await response.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  const fetchBaseData = async (currentFilters: Filters) => {
    try {
      const params = new URLSearchParams();
      if (currentFilters.baseStartDate) params.append('start_date', currentFilters.baseStartDate);
      if (currentFilters.baseEndDate) params.append('end_date', currentFilters.baseEndDate);
      if (currentFilters.problemTopic) params.append('problem_topic', currentFilters.problemTopic);
      const response = await fetch(`/api/chart_data?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setBaseData(await response.json());
    } catch { /* ignore base errors */ }
  };

  useEffect(() => { fetchReportData(filters); }, []);

  const handleFiltersChange = (newFilters: Filters) => {
    setFilters(newFilters);
    fetchReportData(newFilters);
    if (showComparison && newFilters.baseStartDate && newFilters.baseEndDate) {
      fetchBaseData(newFilters);
    }
  };

  const handleBaseFiltersChange = (newFilters: Filters) => {
    setFilters(newFilters);
    if (newFilters.baseStartDate && newFilters.baseEndDate) {
      fetchBaseData(newFilters);
    } else {
      setBaseData([]);
    }
  };

  const handleToggleComparison = (isComparing: boolean) => {
    setShowComparison(isComparing);
    if (!isComparing) {
      setBaseData([]);
      setFilters(prev => ({ ...prev, baseStartDate: '', baseEndDate: '' }));
    }
  };

  const handleDeleteOverdue = async (requestId: string) => {
    try {
      const response = await fetchWithAuth(`/api/overdue/${requestId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchReportData(filters);
        if (showComparison && filters.baseStartDate && filters.baseEndDate) {
          fetchBaseData(filters);
        }
      } else {
        const err = await response.json();
        alert(`Ошибка при удалении: ${err.detail || 'Неизвестная ошибка'}`);
      }
    } catch {
      alert('Ошибка при удалении просрочки');
    }
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
        <p className="text-sm text-red-700 dark:text-red-300">Ошибка загрузки данных: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 flex-shrink-0"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
          <LineChart className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
            Дашборд ММ
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Монитор Мэра — все обращения ЮВАО</p>
        </div>
      </div>

      {/* District filter */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Фильтр по районам</span>
            {!isAllSelected && (
              <span className="text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/30 px-2 py-0.5 rounded-full">
                {selectedDistricts.length} из {ALL_DISTRICTS.length}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                const next = !overdueOnly;
                setOverdueOnly(next);
                fetchReportData(filters, next);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all duration-150 ${
                overdueOnly
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 dark:hover:text-red-400'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${overdueOnly ? 'bg-white' : 'bg-red-400'}`} />
              Только просрочки
            </button>
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
          {ALL_DISTRICTS.map(district => (
            <button
              key={district}
              type="button"
              onClick={() => toggleDistrict(district)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                !isAllSelected && selectedDistricts.includes(district)
                  ? 'bg-primary-600 text-white shadow-sm'
                  : !isAllSelected
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-primary-50 dark:hover:bg-primary-950/20 hover:text-primary-700 dark:hover:text-primary-300'
              }`}
            >
              {district}
            </button>
          ))}
        </div>
      </div>

      <BarChartDashboard
        regions={REGION_IDS}
        data={reportData}
        baseData={baseData}
        onFiltersChange={handleFiltersChange}
        onBaseFiltersChange={handleBaseFiltersChange}
        onToggleComparison={handleToggleComparison}
        showComparison={showComparison}
        currentFilters={filters}
        selectedDistricts={selectedDistricts}
      />

      <DetailedIssuesTable
        regions={REGION_IDS}
        data={reportData}
        baseData={baseData}
        showComparison={showComparison}
        currentFilters={filters}
        isAdmin={isAdmin}
        onDelete={handleDeleteOverdue}
        selectedDistricts={selectedDistricts}
      />
    </div>
  );
}

export default Dashboard;
