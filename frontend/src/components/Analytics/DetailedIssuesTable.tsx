import React, { useState, useMemo } from 'react';
import { saveAs } from 'file-saver';
import { Trash2, Search, X, ArrowUp, ArrowDown, ChevronsUpDown, Download } from 'lucide-react';

interface Issue {
  ID: string;
  date: string;
  region_id: string;
  theme: string;
  Resource: string;
  status: string;
  address: string;
  controlObject: string;
  isOverdue: string;
}

interface DetailedIssuesTableProps {
  data: any[];
  baseData?: any[];
  regions: { [key: string]: string };
  showComparison?: boolean;
  currentFilters?: any;
  isAdmin?: boolean;
  onDelete?: (requestId: string) => void;
  selectedDistricts: string[];
}

const DetailedIssuesTable: React.FC<DetailedIssuesTableProps> = ({
  data, baseData = [], regions, showComparison = false,
  currentFilters = {}, isAdmin = false, onDelete, selectedDistricts,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;
  const [sortField, setSortField] = useState<keyof Issue>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [activePeriod, setActivePeriod] = useState<'report' | 'base'>('report');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [idSearch, setIdSearch] = useState('');

  const displayData = useMemo(() =>
    showComparison ? (activePeriod === 'report' ? data : baseData) : data,
    [data, baseData, activePeriod, showComparison]
  );

  const allIssues: Issue[] = useMemo(() => {
    if (!displayData?.length) return [];
    return displayData.flatMap(day =>
      day.issues.map((i: any) => ({
        ID: i.ID || 'N/A',
        date: i.date,
        region_id: i.region_id,
        theme: i.theme,
        Resource: i.Resource || 'Не указан',
        status: i.status || 'В работе',
        address: i.address || '',
        controlObject: i.controlObject || '',
        isOverdue: i.isOverdue || '',
      }))
    ).filter((i: Issue) => selectedDistricts.includes(i.region_id));
  }, [displayData, selectedDistricts]);

  const sortedIssues = useMemo(() => {
    return [...allIssues].sort((a, b) => {
      const av = String(a[sortField] ?? '');
      const bv = String(b[sortField] ?? '');
      if (sortField === 'date') {
        const diff = new Date(av).getTime() - new Date(bv).getTime();
        return sortDir === 'asc' ? diff : -diff;
      }
      const cmp = av.localeCompare(bv, 'ru');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [allIssues, sortField, sortDir]);

  const filteredIssues = useMemo(() => {
    if (!idSearch.trim()) return sortedIssues;
    const term = idSearch.trim().toLowerCase();
    return sortedIssues.filter(i => i.ID.toLowerCase().includes(term));
  }, [sortedIssues, idSearch]);

  const totalPages = Math.ceil(filteredIssues.length / ITEMS_PER_PAGE);
  const paginatedIssues = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredIssues.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredIssues, currentPage]);

  const handleSort = (field: keyof Issue) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  const getDistrictName = (id: string) => regions[id] || id;

  const isNgOrMzhi = (r: string) => {
    const n = r.trim().toUpperCase();
    return n === 'НГ' || n === 'МЖИ';
  };
  const isCafapOati = (r: string) => {
    const n = r.trim().toUpperCase();
    return n === 'ЦАФАП' || n === 'ОАТИ';
  };
  const ngLink = (id: string) => `https://er.mos.ru/ker/admin/issues/view-common?id=${id}&section=all`;
  const cafapLink = (id: string) => `https://cafap.mos.ru/cabinet?page=1&sort=deadline,asc&issueFolderName=WORK_CUSTOMER2_WORK&query=${id}&number=${id}`;

  function SortIcon({ field }: { field: keyof Issue }) {
    if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 text-gray-400 opacity-60" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-primary-500" />
      : <ArrowDown className="w-3 h-3 text-primary-500" />;
  }

  function getPageNumbers(cur: number, total: number): (number | '...')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (cur > 3) pages.push('...');
    for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
    if (cur < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  }

  const buildExcelRow = (i: Issue) => ({
    'ID нарушения': i.ID,
    'Срок устранения до': new Date(i.date).toLocaleDateString('ru-RU'),
    'Район': getDistrictName(i.region_id),
    'Проблема': i.theme,
    'Система-источник': i.Resource,
    'Статус': i.status,
    'Адрес': i.address || '',
    'Объект контроля': i.controlObject || '',
    'Ссылка': isNgOrMzhi(i.Resource) ? ngLink(i.ID) : isCafapOati(i.Resource) ? cafapLink(i.ID) : 'Нет ссылки',
  });

  const exportSingleToExcel = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allIssues.map(buildExcelRow)), 'Обращения');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `обращения_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportWithSheets = async () => {
    const XLSX = await import('xlsx');
    const toRows = (source: any[]) =>
      source.flatMap(d =>
        d.issues
          .filter((i: any) => selectedDistricts.includes(i.region_id))
          .map((i: any) => buildExcelRow({ ID: i.ID || 'N/A', date: i.date, region_id: i.region_id, theme: i.theme, Resource: i.Resource || 'Не указан', status: i.status || 'В работе', address: i.address || '', controlObject: i.controlObject || '' }))
      );
    const reportRows = toRows(data);
    const baseRows = toRows(baseData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reportRows.length ? reportRows : [{ Данные: 'Нет данных' }]), 'Отчетный период');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(baseRows.length ? baseRows : [{ Данные: 'Нет данных' }]), 'Предыдущий период');
    try {
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', bookSST: false });
      saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `обращения_сравнение_${currentFilters.startDate || 'все'}.xlsx`);
    } catch (e) {
      console.error(e);
      alert('Ошибка при создании Excel файла');
    }
  };

  const thClass = "px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none";

  if (allIssues.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 p-10 flex flex-col items-center justify-center">
        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-3">
          <Search className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Нет данных для отображения</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 flex-grow min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">Детальная таблица</p>
          {showComparison && (
            <div className="flex items-center gap-1.5 ml-1">
              <button
                onClick={() => { setActivePeriod('report'); setCurrentPage(1); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${activePeriod === 'report' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              >Отчетный</button>
              <button
                onClick={() => { setActivePeriod('base'); setCurrentPage(1); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${activePeriod === 'base' ? 'bg-gray-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              >Предыдущий</button>
            </div>
          )}
        </div>

        {/* ID Search */}
        <div className="relative flex-shrink-0 w-full sm:w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={idSearch}
            onChange={e => { setIdSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Поиск по номеру заявки…"
            className="w-full pl-9 pr-8 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500 transition-colors"
          />
          {idSearch && (
            <button type="button" onClick={() => { setIdSearch(''); setCurrentPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {idSearch
              ? <><span className="font-semibold text-primary-600 dark:text-primary-400">{filteredIssues.length}</span> / {allIssues.length}</>
              : <span className="font-semibold">{allIssues.length}</span>
            }
          </span>
          <button
            type="button"
            onClick={showComparison ? exportWithSheets : exportSingleToExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-semibold transition-all duration-150 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className={thClass} onClick={() => handleSort('ID')}>
                <div className="flex items-center gap-1.5">ID нарушения <SortIcon field="ID" /></div>
              </th>
              <th className={thClass} onClick={() => handleSort('date')}>
                <div className="flex items-center gap-1.5">Срок до <SortIcon field="date" /></div>
              </th>
              <th className={thClass} onClick={() => handleSort('region_id')}>
                <div className="flex items-center gap-1.5">Район <SortIcon field="region_id" /></div>
              </th>
              <th className={thClass} onClick={() => handleSort('theme')}>
                <div className="flex items-center gap-1.5">Проблема <SortIcon field="theme" /></div>
              </th>
              <th className={thClass} onClick={() => handleSort('Resource')}>
                <div className="flex items-center gap-1.5">Источник <SortIcon field="Resource" /></div>
              </th>
              <th className={thClass} onClick={() => handleSort('status')}>
                <div className="flex items-center gap-1.5">Статус <SortIcon field="status" /></div>
              </th>
              <th className={thClass} onClick={() => handleSort('address')}>
                <div className="flex items-center gap-1.5">Адрес <SortIcon field="address" /></div>
              </th>
              <th className={thClass} onClick={() => handleSort('controlObject')}>
                <div className="flex items-center gap-1.5">Объект контроля <SortIcon field="controlObject" /></div>
              </th>
              {isAdmin && (
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-gray-800/50">
                  Действия
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {paginatedIssues.map((issue, idx) => (
              <tr key={`${issue.ID}-${idx}`} className={`transition-colors ${
                issue.isOverdue === 'Да'
                  ? 'bg-red-50 dark:bg-red-950/20 hover:bg-red-100/70 dark:hover:bg-red-950/30'
                  : 'hover:bg-gray-50/60 dark:hover:bg-gray-800/30'
              }`}>
                <td className="px-4 py-3 font-mono text-xs">
                  {isNgOrMzhi(issue.Resource) ? (
                    <a href={ngLink(issue.ID)} target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline font-semibold">{issue.ID}</a>
                  ) : isCafapOati(issue.Resource) ? (
                    <a href={cafapLink(issue.ID)} target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline font-semibold">{issue.ID}</a>
                  ) : (
                    <span className="text-gray-700 dark:text-gray-300">{issue.ID}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs">
                  {new Date(issue.date).toLocaleDateString('ru-RU')}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs">
                  {getDistrictName(issue.region_id)}
                </td>
                <td className="px-4 py-3 text-xs max-w-[220px]">
                  <span className="text-gray-700 dark:text-gray-300 truncate block" title={issue.theme}>{issue.theme}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    isNgOrMzhi(issue.Resource)
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : isCafapOati(issue.Resource)
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}>
                    {issue.Resource}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    issue.status === 'Устранено'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : issue.status === 'В работе'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}>
                    {issue.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs max-w-[200px]">
                  <span className="text-gray-700 dark:text-gray-300 truncate block" title={issue.address}>{issue.address || '—'}</span>
                </td>
                <td className="px-4 py-3 text-xs max-w-[180px]">
                  <span className="text-gray-700 dark:text-gray-300 truncate block" title={issue.controlObject}>{issue.controlObject || '—'}</span>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    {deleteConfirm === issue.ID ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => { onDelete?.(issue.ID); setDeleteConfirm(null); }} className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg transition-colors">Да</button>
                        <button onClick={() => setDeleteConfirm(null)} className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">Нет</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(issue.ID)} className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredIssues.length)} из {filteredIssues.length}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">←</button>
            {getPageNumbers(currentPage, totalPages).map((p, i) =>
              p === '...'
                ? <span key={`e${i}`} className="px-1.5 text-xs text-gray-400">…</span>
                : <button key={p} onClick={() => setCurrentPage(p as number)} className={`w-7 h-7 text-xs rounded-lg transition-colors ${currentPage === p ? 'bg-primary-600 text-white' : 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>{p}</button>
            )}
            <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg disabled:opacity-40 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">→</button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
        <span>ID — ссылка для:</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>НГ / МЖИ (Наш город)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>ЦАФАП / ОАТИ</span>
      </div>
    </div>
  );
};

export default DetailedIssuesTable;
