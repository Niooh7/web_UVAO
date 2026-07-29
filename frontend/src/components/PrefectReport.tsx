import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet, Clock, Info, Building2 } from 'lucide-react';
import PDFViewer from './PDFViewer';
import { useReportFiles } from '../hooks/useReportFiles';

interface PrefectReportProps {
  folderName: string;
}

const PrefectReport: React.FC<PrefectReportProps> = ({ folderName }) => {
  const { pdfUrl, excelUrl, lastUpdate, loading } = useReportFiles({ folderName });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-[3px] border-gray-200 dark:border-gray-700" />
          <div className="absolute inset-0 rounded-full border-[3px] border-primary-500 border-t-transparent animate-spin" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Загрузка отчёта…</p>
      </div>
    );
  }

  if (!folderName) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-sm text-gray-500 dark:text-gray-400">Название папки не указано.</p>
      </div>
    );
  }

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
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">
              Сообщения Префекта
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Личный кабинет префектуры</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap ml-[52px] sm:ml-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            <Clock size={13} />
            <span>{lastUpdate || 'Неизвестно'}</span>
          </div>
          {excelUrl && (
            <a
              href={excelUrl}
              download
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-semibold transition-all duration-150 shadow-sm whitespace-nowrap"
            >
              <FileSpreadsheet size={14} />
              <span>Скачать Excel</span>
            </a>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 px-4 py-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
        <div className="w-7 h-7 bg-indigo-100 dark:bg-indigo-900/60 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
          <Info className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <p className="text-sm text-indigo-700 dark:text-indigo-300 leading-relaxed">
          Отчёт обновляется автоматически каждый час с 7:55 до 21:55.
        </p>
      </div>

      {/* PDF */}
      <PDFViewer url={pdfUrl} title="Префект" />
    </div>
  );
};

export default PrefectReport;
