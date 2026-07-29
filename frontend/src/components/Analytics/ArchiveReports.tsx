import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Calendar, ChevronDown, Eye, Download,
  FileText, FileSpreadsheet, Search, X,
  Archive, MessageSquare, Monitor, Building2, BarChart3, Camera, AlertTriangle,
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import PDFViewer from '../PDFViewer';

interface ArchiveFile {
  name: string;
  type: 'pdf' | 'xlsx';
  datetime: string;
}

interface Report {
  date: string;
  files: ArchiveFile[];
}

interface MonthGroup {
  key: string;
  label: string;
  reports: Report[];
}

interface ArchiveReportsProps {
  user: { duty: string };
}

const reportTypes = [
  { id: 'our-city',        title: 'Наш Город',      folder: 'NG',     icon: MessageSquare, color: 'text-violet-600 dark:text-violet-400',   bg: 'bg-violet-100 dark:bg-violet-900/40'   },
  { id: 'mayor-monitor',   title: 'Монитор Мэра',   folder: 'MM',     icon: Monitor,       color: 'text-blue-600   dark:text-blue-400',     bg: 'bg-blue-100   dark:bg-blue-900/40'     },
  { id: 'prefect',         title: 'Префект',         folder: 'Pref',   icon: Building2,     color: 'text-indigo-600 dark:text-indigo-400',   bg: 'bg-indigo-100 dark:bg-indigo-900/40'   },
  { id: 'mzhi',            title: 'МЖИ',             folder: 'MWI',    icon: FileText,      color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
  { id: 'mzhi-statistics', title: 'Статистика МЖИ', folder: 'MWIS',   icon: BarChart3,     color: 'text-teal-600   dark:text-teal-400',     bg: 'bg-teal-100   dark:bg-teal-900/40'     },
  { id: 'tsafap',          title: 'ЦАФАП',           folder: 'TSAFAP', icon: Camera,        color: 'text-orange-600 dark:text-orange-400',   bg: 'bg-orange-100 dark:bg-orange-900/40'   },
  { id: 'oati',            title: 'ОАТИ',            folder: 'OATI',   icon: AlertTriangle, color: 'text-red-600    dark:text-red-400',       bg: 'bg-red-100    dark:bg-red-900/40'      },
];

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

function formatMonthLabel(key: string): string {
  const [yyyy, mm] = key.split('-');
  return `${MONTH_NAMES[parseInt(mm, 10) - 1]} ${yyyy}`;
}

function ArchiveReports({ user }: ArchiveReportsProps) {
  const [selectedType, setSelectedType] = useState('');
  const [reports, setReports]           = useState<Report[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [searchQuery, setSearchQuery]   = useState('');
  const [startDate, setStartDate]       = useState<Date | null>(null);
  const [endDate, setEndDate]           = useState<Date | null>(null);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const [viewingPdf, setViewingPdf]     = useState<{ url: string; title: string } | null>(null);

  // Load archive when type changes
  useEffect(() => {
    if (!selectedType) return;
    const folder = reportTypes.find(t => t.id === selectedType)?.folder;
    if (!folder) return;
    setLoading(true);
    setError('');
    setCollapsedMonths(new Set());
    fetch(`/api/archive?folder=${folder}`)
      .then(r => { if (!r.ok) throw new Error(`Ошибка сервера: ${r.status}`); return r.json(); })
      .then((data: Report[]) => setReports(data || []))
      .catch(e => { setError(`Ошибка загрузки: ${e.message}`); setReports([]); })
      .finally(() => setLoading(false));
  }, [selectedType]);

  // Filtered reports
  const filtered = useMemo(() => {
    if (!searchQuery && !startDate && !endDate) return reports;
    return reports.filter(r => {
      const parts = r.date.split('.');
      if (parts.length !== 3) return false;
      const d = new Date(+parts[2], +parts[1] - 1, +parts[0]);
      const afterStart  = !startDate || d >= startDate;
      const beforeEnd   = !endDate   || d <= endDate;
      const matchSearch = !searchQuery ||
        r.date.includes(searchQuery) ||
        r.files.some(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
      return afterStart && beforeEnd && matchSearch;
    });
  }, [reports, searchQuery, startDate, endDate]);

  // Group by month, newest first
  const monthGroups = useMemo((): MonthGroup[] => {
    const map = new Map<string, Report[]>();
    for (const r of filtered) {
      const parts = r.date.split('.');
      if (parts.length !== 3) continue;
      const key = `${parts[2]}-${parts[1]}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return [...map.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, reps]) => ({
        key,
        label: formatMonthLabel(key),
        reports: reps.sort((a, b) => b.date.localeCompare(a.date)),
      }));
  }, [filtered]);

  const toggleMonth = useCallback((key: string) => {
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const clearFilters = () => { setStartDate(null); setEndDate(null); setSearchQuery(''); };

  const folder = reportTypes.find(t => t.id === selectedType)?.folder ?? '';
  const typeTitle = reportTypes.find(t => t.id === selectedType)?.title ?? '';

  const getDownloadUrl = (fileName: string) =>
    `/api/archive/download?folder=${folder}&file=${encodeURIComponent(fileName)}`;

  const viewPdf = (file: ArchiveFile, date: string) => {
    if (file.type === 'pdf') {
      setViewingPdf({ url: getDownloadUrl(file.name), title: `${typeTitle} — ${date}` });
    }
  };

  const hasFilters = !!(startDate || endDate || searchQuery);
  const totalReports = filtered.length;
  const totalFiles   = filtered.reduce((s, r) => s + r.files.length, 0);

  if (user.duty !== 'Префектура') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-5 text-center animate-fade-in">
        <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Доступ ограничен</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Этот раздел доступен только для Префектуры</p>
        </div>
        <Link to="/" className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-colors">
          <ArrowLeft size={15} />На главную
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* PDF Modal */}
      {viewingPdf && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-5">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <div className="w-8 h-8 bg-red-100 dark:bg-red-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate flex-1">{viewingPdf.title}</p>
              <button
                onClick={() => setViewingPdf(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <PDFViewer url={viewingPdf.url} title={viewingPdf.title} />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5 animate-fade-in">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 flex-shrink-0"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
            <Archive className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">Архив отчётов</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">История всех типов отчётов</p>
          </div>
        </div>

        {/* Report type pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-none">
          {reportTypes.map(t => {
            const active = selectedType === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => { setSelectedType(t.id); clearFilters(); }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0
                  ${active
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
              >
                <Icon size={14} />
                {t.title}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        {selectedType && (
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Поиск по дате (напр. 15.06) или имени файла…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-primary-400 dark:focus:border-primary-600 transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <X size={13} className="text-gray-400" />
                </button>
              )}
            </div>
            <DatePicker
              selected={startDate}
              onChange={(d: Date | null) => setStartDate(d)}
              dateFormat="dd.MM.yyyy"
              placeholderText="Дата с"
              isClearable
              className="w-full sm:w-36 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary-400 dark:focus:border-primary-600 transition-colors"
            />
            <DatePicker
              selected={endDate}
              onChange={(d: Date | null) => setEndDate(d)}
              dateFormat="dd.MM.yyyy"
              placeholderText="Дата по"
              isClearable
              minDate={startDate ?? undefined}
              className="w-full sm:w-36 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary-400 dark:focus:border-primary-600 transition-colors"
            />
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-800 text-sm transition-all duration-150 whitespace-nowrap"
              >
                <X size={14} /> Сбросить
              </button>
            )}
          </div>
        )}

        {/* Stats */}
        {selectedType && !loading && !error && filtered.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-xl font-semibold text-gray-600 dark:text-gray-400">
              <Calendar size={13} />
              {totalReports} {totalReports === 1 ? 'отчёт' : totalReports < 5 ? 'отчёта' : 'отчётов'}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-xl font-semibold text-gray-600 dark:text-gray-400">
              {totalFiles} {totalFiles === 1 ? 'файл' : totalFiles < 5 ? 'файла' : 'файлов'}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-xl font-semibold text-gray-600 dark:text-gray-400">
              {monthGroups.length} {monthGroups.length === 1 ? 'месяц' : monthGroups.length < 5 ? 'месяца' : 'месяцев'}
            </span>
            {hasFilters && (
              <span className="text-gray-400 dark:text-gray-500">из {reports.length} всего</span>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border-[3px] border-gray-200 dark:border-gray-700" />
              <div className="absolute inset-0 rounded-full border-[3px] border-primary-500 border-t-transparent animate-spin" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Загрузка архива…</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 px-4 py-3 bg-red-50 dark:bg-red-950/30 rounded-2xl border border-red-100 dark:border-red-900/50">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Empty: no type */}
        {!selectedType && !loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
              <Archive className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Выберите тип отчёта</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Нажмите на одну из кнопок выше</p>
            </div>
          </div>
        )}

        {/* Empty: no results after filter */}
        {selectedType && !loading && !error && filtered.length === 0 && reports.length > 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
              <Search className="w-7 h-7 text-gray-400 dark:text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ничего не найдено</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Попробуйте изменить фильтры</p>
            </div>
            <button onClick={clearFilters} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-xl transition-colors">
              Сбросить фильтры
            </button>
          </div>
        )}

        {/* Empty: no reports at all */}
        {selectedType && !loading && !error && reports.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
              <Calendar className="w-7 h-7 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Архив пуст или данные не найдены</p>
          </div>
        )}

        {/* Month accordion */}
        {!loading && !error && monthGroups.length > 0 && (
          <div className="space-y-3">
            {monthGroups.map((group, groupIdx) => {
              // Group 0 starts open (open = NOT in set). Others start closed (open = IS in set).
              const actuallyOpen = groupIdx === 0
                ? !collapsedMonths.has(group.key)
                : collapsedMonths.has(group.key);

              return (
                <div
                  key={group.key}
                  className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden"
                >
                  {/* Month header */}
                  <button
                    onClick={() => toggleMonth(group.key)}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <span className="font-bold text-gray-900 dark:text-white text-sm capitalize">
                        {group.label}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-xs font-medium text-gray-500 dark:text-gray-400">
                        {group.reports.length} {group.reports.length === 1 ? 'отчёт' : group.reports.length < 5 ? 'отчёта' : 'отчётов'}
                      </span>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-gray-400 transition-transform duration-200 flex-shrink-0 ${actuallyOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Date rows */}
                  {actuallyOpen && (
                    <div className="border-t border-gray-100 dark:border-gray-800">
                      {group.reports.map((report, ri) => (
                        <div
                          key={report.date}
                          className={`${ri !== group.reports.length - 1 ? 'border-b border-gray-50 dark:border-gray-800/60' : ''}`}
                        >
                          {/* Date label */}
                          <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 dark:bg-indigo-500 flex-shrink-0" />
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{report.date}</span>
                            <span className="text-[11px] text-gray-400 dark:text-gray-500">
                              {report.files.length} {report.files.length === 1 ? 'файл' : 'файла'}
                            </span>
                          </div>

                          {/* Files */}
                          <div className="px-4 pb-3 flex flex-wrap gap-2">
                            {report.files.map((file, fi) => (
                              <div
                                key={fi}
                                className="flex items-center gap-2 pl-3 pr-2 py-2 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                              >
                                {/* File type icon */}
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                  file.type === 'pdf'
                                    ? 'bg-red-100 dark:bg-red-900/40'
                                    : 'bg-emerald-100 dark:bg-emerald-900/40'
                                }`}>
                                  {file.type === 'pdf'
                                    ? <FileText className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                                    : <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                  }
                                </div>

                                {/* File info */}
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[180px]">
                                    {file.name}
                                  </p>
                                  {file.datetime && (
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{file.datetime}</p>
                                  )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                                  {file.type === 'pdf' && (
                                    <button
                                      onClick={() => viewPdf(file, report.date)}
                                      title="Открыть"
                                      className="w-7 h-7 rounded-lg bg-primary-600 hover:bg-primary-700 flex items-center justify-center text-white transition-colors active:scale-95"
                                    >
                                      <Eye size={13} />
                                    </button>
                                  )}
                                  <a
                                    href={getDownloadUrl(file.name)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Скачать"
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors active:scale-95 ${
                                      file.type === 'pdf'
                                        ? 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300'
                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    }`}
                                  >
                                    <Download size={13} />
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export default ArchiveReports;
