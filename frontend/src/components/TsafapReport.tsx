import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet, Clock, AlertTriangle, Camera } from 'lucide-react';
import PDFViewer from './PDFViewer';
import { useReportFiles } from '../hooks/useReportFiles';

interface TsafapReportProps {
  folderName: string;
}

const TsafapReport: React.FC<TsafapReportProps> = ({ folderName }) => {
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
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">
              Нарушения ЦАФАП
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Фиксация нарушений камерами</p>
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
      <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-100 dark:border-amber-900/50">
        <div className="w-7 h-7 bg-amber-100 dark:bg-amber-900/60 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed space-y-0.5">
          <p>Сводная таблица нарушений, зафиксированных ЦАФАП за вчерашний день.</p>
          <p className="text-amber-600 dark:text-amber-400">Отчёт обновляется автоматически каждое утро в 09:30.</p>
        </div>
      </div>

      {/* PDF */}
      <PDFViewer url={pdfUrl} title="Нарушения ЦАФАП" />
    </div>
  );
};

export default TsafapReport;
