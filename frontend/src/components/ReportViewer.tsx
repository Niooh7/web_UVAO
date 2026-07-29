import React, { useState, useEffect, useCallback } from 'react';
import { fetchWithAuth } from '../utils/api';
import { useParams } from 'react-router-dom';
import { RefreshCw, Loader2, CheckCircle, AlertCircle, Zap, AlertTriangle, Clock } from 'lucide-react';
import { User } from '../types';
import OurCityReport from './OurCityReport';
import MayorMonitorReport from './MayorMonitorReport';
import PrefectReport from './PrefectReport';
import MzhiReport from './MzhiReport';
import MzhiStatisticsReport from './MzhiStatisticsReport';
import TsafapReport from './TsafapReport';
import OatiReport from './OatiReport';

const folderMapping: { [key: string]: string } = {
  'our-city': 'NG',
  'mayor-monitor': 'MM',
  'prefect': 'Pref',
  'mzhi': 'MWI',
  'mzhi-statistics': 'MWIS',
  'tsafap': 'TSAFAP',
  'oati': 'OATI',
};

// Maps frontend route type → failure_state.json key
const stateKeyMapping: { [key: string]: string } = {
  'our-city': 'ng',
  'mayor-monitor': 'mm',
  'prefect': 'ng',
  'mzhi': 'mwi',
  'mzhi-statistics': 'mwis',
  'tsafap': 'tsafap',
  'oati': 'oati',
};

interface ReportState {
  consecutive_failures: number;
  last_success: string | null;
  last_error: string | null;
  is_degraded: boolean;
}

const reportLabels: { [key: string]: string } = {
  'our-city': 'Наш Город',
  'mayor-monitor': 'Монитор Мэра',
  'prefect': 'ЛК Префекта',
  'mzhi': 'Сообщения МЖИ',
  'mzhi-statistics': 'Статистика МЖИ',
  'tsafap': 'ЦАФАП',
  'oati': 'ОАТИ',
};

type GenerationStatus = 'idle' | 'loading' | 'success' | 'error';

interface ReportViewerProps {
  user: User | null;
}

function ReportViewer({ user }: ReportViewerProps) {
  const { type } = useParams<{ type: string }>();
  const folderName = folderMapping[type || ''] || '';

  const isAdmin = !!user?.is_admin;
  const [genStatus, setGenStatus] = useState<GenerationStatus>('idle');
  const [genMessage, setGenMessage] = useState('');
  const [reportState, setReportState] = useState<ReportState | null>(null);

  // Сбрасываем статус при смене отчёта
  useEffect(() => {
    setGenStatus('idle');
    setGenMessage('');
    setReportState(null);
  }, [type]);

  // Загружаем статус выгрузки — при смене отчёта и каждые 60 секунд
  useEffect(() => {
    if (!type) return;
    const stateKey = stateKeyMapping[type];
    if (!stateKey) return;
    const fetchStatus = () => {
      fetch('/api/report-status')
        .then(r => r.json())
        .then((data: Record<string, ReportState>) => {
          setReportState(data[stateKey] ?? null);
        })
        .catch(() => setReportState(null));
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, [type]);

  const handleGenerate = useCallback(async () => {
    if (!user?.login || genStatus === 'loading') return;
    setGenStatus('loading');
    setGenMessage('');
    try {
      const res = await fetchWithAuth('/api/admin/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_type: type }),
      });
      const data = await res.json();
      if (res.ok) {
        setGenStatus('success');
        setGenMessage('Генерация запущена. Отчёт обновится через несколько минут.');
      } else {
        setGenStatus('error');
        setGenMessage(data.detail || 'Неизвестная ошибка');
      }
    } catch {
      setGenStatus('error');
      setGenMessage('Не удалось подключиться к серверу.');
    }

    // Автосброс через 8 секунд
    setTimeout(() => {
      setGenStatus('idle');
      setGenMessage('');
    }, 8000);
  }, [user?.login, type, genStatus]);

  const renderReport = () => {
    switch (type) {
      case 'our-city':         return <OurCityReport folderName={folderName} />;
      case 'mayor-monitor':    return <MayorMonitorReport folderName={folderName} />;
      case 'prefect':          return <PrefectReport folderName={folderName} />;
      case 'mzhi':             return <MzhiReport folderName={folderName} />;
      case 'mzhi-statistics':  return <MzhiStatisticsReport folderName={folderName} />;
      case 'tsafap':           return <TsafapReport folderName={folderName} />;
      case 'oati':             return <OatiReport folderName={folderName} />;
      default:                 return <div className="text-sm text-gray-500 dark:text-gray-400">Отчёт не найден</div>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Баннер деградации — виден всем при сбое выгрузки ≥ 2 раз */}
      {reportState?.is_degraded && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-2xl border bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/50">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-orange-100 dark:bg-orange-900/60 mt-0.5">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-orange-700 dark:text-orange-300">
              Данные временно недоступны
            </p>
            <p className="text-xs text-orange-600/80 dark:text-orange-400/80 mt-0.5">
              Последняя выгрузка не удалась — все попытки исчерпаны. Отображаются данные предыдущего обновления.
              Следующая попытка произойдёт автоматически по расписанию.
            </p>
            {reportState.last_success && (
              <p className="flex items-center gap-1 text-xs text-orange-500/70 dark:text-orange-400/60 mt-1">
                <Clock className="w-3 h-3" />
                Последнее успешное обновление: {reportState.last_success}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Панель администратора — видна только админу */}
      {isAdmin && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors ${
          genStatus === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50'
            : genStatus === 'error'
            ? 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/50'
            : 'bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/50'
        }`}>
          {/* Иконка статуса */}
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
            genStatus === 'success'
              ? 'bg-emerald-100 dark:bg-emerald-900/60'
              : genStatus === 'error'
              ? 'bg-red-100 dark:bg-red-900/60'
              : 'bg-amber-100 dark:bg-amber-900/60'
          }`}>
            {genStatus === 'success' ? (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : genStatus === 'error' ? (
              <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            )}
          </div>

          {/* Текст */}
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-semibold ${
              genStatus === 'success'
                ? 'text-emerald-700 dark:text-emerald-300'
                : genStatus === 'error'
                ? 'text-red-700 dark:text-red-300'
                : 'text-amber-700 dark:text-amber-300'
            }`}>
              {genStatus === 'idle' || genStatus === 'loading'
                ? 'Панель администратора'
                : genStatus === 'success'
                ? 'Успешно запущено'
                : 'Ошибка запуска'}
            </p>
            {genMessage ? (
              <p className={`text-xs mt-0.5 ${
                genStatus === 'success'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : genStatus === 'error'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}>
                {genMessage}
              </p>
            ) : (
              <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-0.5">
                {reportLabels[type || ''] || 'Отчёт'}
              </p>
            )}
          </div>

          {/* Кнопка */}
          <button
            onClick={handleGenerate}
            disabled={genStatus === 'loading'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 flex-shrink-0 ${
              genStatus === 'loading'
                ? 'bg-amber-400 dark:bg-amber-700 text-white opacity-70 cursor-not-allowed'
                : 'bg-amber-600 hover:bg-amber-700 active:scale-95 text-white shadow-sm'
            }`}
          >
            {genStatus === 'loading' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            {genStatus === 'loading' ? 'Запускается…' : 'Создать отчёт'}
          </button>
        </div>
      )}

      {renderReport()}
    </div>
  );
}

export default ReportViewer;
