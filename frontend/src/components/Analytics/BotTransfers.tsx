import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ClipboardList, CheckCircle2, Clock, XCircle, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import api from '../../utils/api';
import { User } from '../../types';

interface BotTransfersProps {
  user: User;
}

interface Transfer {
  id: number;
  status: string;
  created_at: string;
  district: string;
  level: string;
  portal_number: string;
  transfer_type: string;
  desired_date: string;
  reject_reason: string | null;
}

interface TransfersResponse {
  data: Transfer[];
  total: number;
  total_approved: number;
  total_rejected: number;
  total_pending: number;
  page: number;
  page_size: number;
}

const DISTRICTS = [
  'АВД ЮВАО', 'Выхино-Жулебино', 'Капотня', 'Кузьминки', 'Лефортово',
  'Люблино', 'Марьино', 'Некрасовка', 'Нижегородский', 'Печатники',
  'Рязанский', 'Текстильщики', 'Южнопортовый',
];


function getStatusStyle(status: string): string {
  if (status === 'Одобрена') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50';
  }
  if (status === 'Отклонена') {
    return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800/50';
  }
  return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50';
}

function getRowStyle(status: string): string {
  if (status === 'Одобрена') {
    return 'bg-emerald-50/40 dark:bg-emerald-950/10 hover:bg-emerald-50 dark:hover:bg-emerald-950/20';
  }
  if (status === 'Отклонена') {
    return 'bg-red-50/40 dark:bg-red-950/10 hover:bg-red-50 dark:hover:bg-red-950/20';
  }
  return 'bg-amber-50/30 dark:bg-amber-950/10 hover:bg-amber-50 dark:hover:bg-amber-950/20';
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr.replace(' ', 'T'));
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
  } catch {
    return dateStr;
  }
}

function formatDesiredDate(dateStr: string): string {
  if (!dateStr) return '—';
  // Already DD.MM.YYYY
  if (/^\d{2}\.\d{2}\.\d{4}/.test(dateStr)) return dateStr.substring(0, 10);
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const [y, m, d] = dateStr.substring(0, 10).split('-');
    return `${d}.${m}.${y}`;
  }
  return dateStr;
}

const PAGE_SIZE = 50;

export default function BotTransfers({ user: _user }: BotTransfersProps) {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [total, setTotal] = useState(0);
  const [totalApproved, setTotalApproved] = useState(0);
  const [totalRejected, setTotalRejected] = useState(0);
  const [totalPending, setTotalPending] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [portalSearch, setPortalSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async (pg: number, districts: string[], search: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(pg));
      params.append('page_size', String(PAGE_SIZE));
      districts.forEach(d => params.append('district', d));
      if (search.trim()) params.append('portal_search', search.trim());

      const { data } = await api.get<TransfersResponse>(`/api/bot-transfers?${params}`);
      setTransfers(data.data);
      setTotal(data.total);
      setTotalApproved(data.total_approved);
      setTotalRejected(data.total_rejected);
      setTotalPending(data.total_pending);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(page, selectedDistricts, portalSearch);
  }, [page, selectedDistricts, fetchData]);

  const handleSearchChange = (value: string) => {
    setPortalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchData(1, selectedDistricts, value);
    }, 400);
  };

  const toggleDistrict = (d: string) => {
    setPage(1);
    setSelectedDistricts(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    );
  };

  const clearDistricts = () => {
    setPage(1);
    setSelectedDistricts([]);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
          <ClipboardList className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Заявки на перенос</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Все заявки через бота-согласователя</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/30">
          <div className="flex items-center gap-2 mb-1.5">
            <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Всего заявок</span>
          </div>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{total}</p>
        </div>
        <div className="rounded-2xl p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30">
          <div className="flex items-center gap-2 mb-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Одобрено</span>
          </div>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{totalApproved}</p>
        </div>
        <div className="rounded-2xl p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30">
          <div className="flex items-center gap-2 mb-1.5">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">На рассмотрении</span>
          </div>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{totalPending}</p>
        </div>
        <div className="rounded-2xl p-4 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/30">
          <div className="flex items-center gap-2 mb-1.5">
            <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span className="text-xs font-semibold text-red-600 dark:text-red-400">Отклонено</span>
          </div>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">{totalRejected}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 p-4 space-y-4">
        <div>
          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest mb-2.5">
            Район
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={clearDistricts}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                selectedDistricts.length === 0
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              Все
            </button>
            {DISTRICTS.map(d => (
              <button
                key={d}
                onClick={() => toggleDistrict(d)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                  selectedDistricts.includes(d)
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest mb-2.5">
            Поиск по номеру на НГ
          </p>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={portalSearch}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Введите номер..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition-all"
            />
            {portalSearch && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
          {portalSearch && (
            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-600">
              Показаны заявки содержащие «{portalSearch}»
            </p>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="relative w-9 h-9">
              <div className="absolute inset-0 rounded-full border-[3px] border-gray-200 dark:border-gray-700" />
              <div className="absolute inset-0 rounded-full border-[3px] border-primary-500 border-t-transparent animate-spin" />
            </div>
          </div>
        ) : transfers.length === 0 ? (
          <div className="text-center py-16">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-700" />
            <p className="text-sm text-gray-400 dark:text-gray-600">Нет данных по выбранным фильтрам</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {['№', 'Статус', 'Создана', 'Район', 'Уровень', 'Номер(-а) на НГ', 'Тип заявки', 'Желаемая дата', 'Причина отказа'].map(col => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transfers.map(t => (
                  <tr
                    key={t.id}
                    className={`border-b border-gray-50 dark:border-gray-800/50 transition-colors ${getRowStyle(t.status)}`}
                  >
                    <td className="px-4 py-3 text-gray-400 dark:text-gray-500 font-mono text-xs whitespace-nowrap">
                      {t.id}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${getStatusStyle(t.status)}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">
                      {formatDateTime(t.created_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white font-medium whitespace-nowrap">
                      {t.district || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {t.level || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono text-xs max-w-[180px]">
                      <span className="block truncate" title={t.portal_number || ''}>
                        {t.portal_number || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {t.transfer_type || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {formatDesiredDate(t.desired_date)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-500 text-xs italic max-w-[200px]">
                      {t.reject_reason
                        ? <span className="block truncate" title={t.reject_reason}>{t.reject_reason}</span>
                        : <span className="opacity-30">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {total} записей · Страница {page} из {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1 <= 5 ? i + 1 : i === 5 ? -1 : totalPages;
                } else if (page >= totalPages - 3) {
                  pageNum = i === 0 ? 1 : i === 1 ? -1 : totalPages - 6 + i;
                } else {
                  const map = [1, -1, page - 1, page, page + 1, -2, totalPages];
                  pageNum = map[i];
                }
                if (pageNum < 0) {
                  return <span key={i} className="px-1 text-gray-400 dark:text-gray-600 text-xs">…</span>;
                }
                return (
                  <button
                    key={i}
                    onClick={() => setPage(pageNum)}
                    className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      pageNum === page
                        ? 'bg-primary-600 text-white'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
