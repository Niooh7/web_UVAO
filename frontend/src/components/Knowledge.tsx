import React, { useState } from 'react';
import {
  FileText, Video, Download, Eye,
  ChevronRight, BookOpen, PlayCircle, ExternalLink,
  HelpCircle, Mail, Clock, Search, X,
  ClipboardList, BarChart3, Map, Globe,
} from 'lucide-react';
import { User } from '../types';
import PDFViewer from './PDFViewer';

interface KnowledgeProps {
  user: User;
}

interface Resource {
  title: string;
  description: string;
  type: 'pdf' | 'video';
  filename: string;
  videoUrl?: string;
  excelFilename?: string;
  viewInBrowser?: boolean;
}

interface Section {
  id: string;
  title: string;
  description: string;
  resources: Resource[];
  allowedOrganizations: string[];
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

const knowledgeSections: Section[] = [
  {
    id: 'edo',
    title: 'Поручения',
    description: 'Инструкции по закрытию поручений',
    icon: ClipboardList,
    allowedOrganizations: ['Префектура ЮВАО', 'ГКУ Дирекция ЖКХиБ ЮВАО'],
    resources: [
      {
        title: 'Руководство по закрытию поручения "Город идей"',
        description: 'Подробная инструкция по закрытию поручения "Город идей" на сайте mosedo',
        type: 'pdf',
        filename: 'gorodidei.pdf',
        excelFilename: 'Город идей.docx',
        viewInBrowser: true,
      },
    ],
  },
  {
    id: 'reports',
    title: 'Отчеты',
    description: 'Инструкции по созданию различных отчетов',
    icon: BarChart3,
    allowedOrganizations: ['Префектура ЮВАО', 'ГКУ Дирекция ЖКХиБ ЮВАО'],
    resources: [
      {
        title: 'Руководство по созданию отчета "Ответы в работе"',
        description: 'Подробная инструкция по созданию отчета "Ответы в работе" для мониторинга сообщений на портале "Наш город"',
        type: 'pdf',
        filename: 'otvetyvrabote.pdf',
        excelFilename: 'our-city-shablon.xlsx',
        viewInBrowser: true,
      },
      {
        title: 'Руководство по выгрузке с ИАС Спорт',
        description: 'Подробная инструкция того, как выгружать те или иные спортивные зоны с ИАС Спорт',
        type: 'video',
        filename: 'delete_monitor.mp4',
        videoUrl: 'https://rutube.ru/video/private/195f7a98e79b5ad0ba59a4f70519153c/?p=nvgX7e0uMEHdrBMEpMU4BA',
      },
      {
        title: 'Руководство по созданию ежемесячного отчета 55 по монитору',
        description: 'Подробная инструкция по созданию ежемесячного отчета 55 со всех систем-источников',
        type: 'pdf',
        filename: '55.pdf',
        excelFilename: '55.pptx',
        viewInBrowser: true,
      },
      {
        title: 'Руководство по созданию отчета "114. СВОД ММ"',
        description: 'Подробная инструкция по созданию отчета "114. СВОД ММ" для еженедельного просмотра сообщений на мониторе мэра',
        type: 'video',
        filename: '114 svod_V3.py',
        excelFilename: '114 svod_V3.py',
        videoUrl: 'https://rutube.ru/video/private/43543456db55939b4cf0882522a79583/?p=Y_JBeXojBrk3dFhHG95ylA',
      },
    ],
  },
  {
    id: 'otrisovka',
    title: 'Отрисовка и актуализация ГИС ЕХД',
    description: 'Инструкции по отрисовке и закрытию сообщений по актуализации данных на ГИС ЕХД',
    icon: Map,
    allowedOrganizations: ['Префектура ЮВАО', 'ГКУ Дирекция ЖКХиБ ЮВАО'],
    resources: [
      {
        title: 'Удаление и редактирование объекта на ГИС ЕХД',
        description: 'Подробная инструкция по удалению и редактированию существующего объекта на ГИС ЕХД',
        type: 'pdf',
        filename: '1. gis.pdf',
        viewInBrowser: true,
      },
      {
        title: 'Создание парковой территории/сквера',
        description: 'Подробная инструкция по созданию нового парка/сквера на ГИС ЕХД',
        type: 'pdf',
        filename: '2. gis.pdf',
        viewInBrowser: true,
      },
      {
        title: 'Создание велосипедной дорожки',
        description: 'Подробная инструкция по созданию новой велосипедной дорожки на ГИС ЕХД',
        type: 'pdf',
        filename: 'gorodidei.pdf',
        excelFilename: 'Город идей.docx',
        viewInBrowser: true,
      },
      {
        title: 'Создание фонтана',
        description: 'Подробная инструкция по созданию нового фонтана на ГИС ЕХД',
        type: 'pdf',
        filename: 'gorodidei.pdf',
        excelFilename: 'Город идей.docx',
        viewInBrowser: true,
      },
      {
        title: 'Создание площадки для выгула (дрессировки) собак',
        description: 'Подробная инструкция по созданию новой площадки для выгула (дрессировки) собак на ГИС ЕХД',
        type: 'pdf',
        filename: 'gorodidei.pdf',
        excelFilename: 'Город идей.docx',
        viewInBrowser: true,
      },
    ],
  },
  {
    id: 'portal-work',
    title: 'Работа с порталом',
    description: 'Обучающие материалы по работе с различными порталами',
    icon: Globe,
    allowedOrganizations: [
      'Префектура ЮВАО', 'ГКУ Дирекция ЖКХиБ ЮВАО',
      'ГБУ «Автомобильные дороги ЮВАО»', 'ГБУ «Жилищник Выхино района «Выхино-Жулебино»',
      'ГБУ «Жилищник Нижегородского района»', 'ГБУ «Жилищник района Кузьминки»',
      'ГБУ «Жилищник района Лефортово»', 'ГБУ «Жилищник района Люблино»',
      'ГБУ «Жилищник района Печатники»', 'ГБУ «Жилищник района Текстильщики»',
      'Управа Нижегородского района', 'Управа района Выхино-Жулебино', 'Управа района Лефортово',
      'Управа района Люблино', 'Управа района Марьино', 'Управа района Некрасовка',
      'Управа района Текстильщики', 'Управа района Южнопортовый', 'Управа Рязанского района',
    ],
    resources: [
      {
        title: 'Видеоинструкция: Выход техники',
        description: 'Обучающее видео по формированию отчета о работе техники на ДТ и ОДХ с использованием фиксаграммы',
        type: 'video',
        filename: 'vihod.mp4',
        excelFilename: 'shablon_vihoda_tehniki.xlsx',
      },
      {
        title: 'Видеоинструкция: Снятие просрока с заявки',
        description: 'Обучающее видео по снятию просрока с заявки на АРМ Префектур. Если заявка просрочена по необъективным причинам, вы можете предоставить аргументы и снять просрочку',
        type: 'video',
        filename: 'delete_monitor.mp4',
        videoUrl: 'https://rutube.ru/video/private/a38c3482186bbdd793822e22ff34a0ac/?p=XADujaTPB9zFpwI4em4peg',
      },
      {
        title: 'Видеоинструкция: Выгрузка с ММ по поступившим/просрочкам',
        description: 'Обучающее видео по формированию выгрузки на АРМ Префектур. Помимо объяснения как сделать выгрузка в ММ, тут еще рассказано - как работать со сводными таблицами',
        type: 'video',
        filename: 'delete_monitor.mp4',
        videoUrl: 'https://rutube.ru/video/private/22d825f83ce0d88f7a8fe320865baff6/?p=WMppEYKkYGzoXU2jLU0taA',
      },
    ],
  },
];

function Knowledge({ user }: KnowledgeProps) {
  const [activeSection, setActiveSection] = useState<string>('');
  const [viewingPdf, setViewingPdf] = useState<Resource | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const availableSections = knowledgeSections.filter(section =>
    section.allowedOrganizations.includes(user.organization)
  );

  const filteredSections = searchQuery
    ? availableSections.map(section => ({
        ...section,
        resources: section.resources.filter(resource =>
          resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          resource.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(section => section.resources.length > 0)
    : availableSections;

  const handleViewResource = (resource: Resource) => {
    if (resource.type === 'pdf' && resource.viewInBrowser) {
      setViewingPdf(resource);
    } else if (resource.type === 'video' && resource.videoUrl) {
      window.open(resource.videoUrl, '_blank', 'noopener,noreferrer');
    } else {
      const link = document.createElement('a');
      link.href = `/baza/${resource.filename}`;
      link.download = resource.filename;
      link.click();
    }
  };

  const pdfCount = availableSections.reduce((acc, s) =>
    acc + s.resources.filter(r => r.type === 'pdf').length, 0);
  const videoCount = availableSections.reduce((acc, s) =>
    acc + s.resources.filter(r => r.type === 'video').length, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* PDF Modal */}
      {viewingPdf && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full h-full max-w-7xl max-h-[95vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 rounded-t-2xl flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 bg-red-100 dark:bg-red-950/40 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {viewingPdf.title}
                </h3>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                <a
                  href={`/baza/${viewingPdf.filename}`}
                  download
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Скачать</span>
                </a>
                <button
                  onClick={() => setViewingPdf(null)}
                  className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <PDFViewer url={`/baza/${viewingPdf.filename}`} title={viewingPdf.title} />
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-cyan-700 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">База знаний</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Обучающие материалы и документация</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap ml-[52px] sm:ml-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            <FileText className="w-3.5 h-3.5" />
            <span>{pdfCount} PDF</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            <Video className="w-3.5 h-3.5" />
            <span>{videoCount} видео</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию или описанию..."
            className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 px-1">
            Найдено разделов:{' '}
            <span className="font-semibold text-primary-600 dark:text-primary-400">{filteredSections.length}</span>
          </p>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {filteredSections.map((section) => {
          const SectionIcon = section.icon;
          return (
            <div key={section.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 overflow-hidden">
              <button
                type="button"
                onClick={() => setActiveSection(activeSection === section.id ? '' : section.id)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-cyan-50 dark:bg-cyan-950/30 rounded-xl flex items-center justify-center flex-shrink-0">
                    <SectionIcon className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{section.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{section.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                    {section.resources.length} материал{section.resources.length === 1 ? '' : section.resources.length <= 4 ? 'а' : 'ов'}
                  </span>
                  <ChevronRight
                    className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${activeSection === section.id ? 'rotate-90' : ''}`}
                  />
                </div>
              </button>

              {activeSection === section.id && (
                <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-3 bg-gray-50/50 dark:bg-gray-800/20 animate-fade-in">
                  {section.resources.map((resource, index) => (
                    <div
                      key={index}
                      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          resource.type === 'pdf'
                            ? 'bg-red-50 dark:bg-red-950/30'
                            : 'bg-blue-50 dark:bg-blue-950/30'
                        }`}>
                          {resource.type === 'pdf'
                            ? <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />
                            : <Video className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          }
                        </div>
                        <div className="flex-grow min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{resource.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">{resource.description}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleViewResource(resource)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                resource.type === 'pdf' && resource.viewInBrowser
                                  ? 'bg-red-600 hover:bg-red-700 text-white'
                                  : resource.type === 'video' && resource.videoUrl
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                  : 'bg-primary-600 hover:bg-primary-700 text-white'
                              }`}
                            >
                              {resource.type === 'pdf' && resource.viewInBrowser ? (
                                <><Eye className="w-3.5 h-3.5" /> Просмотреть</>
                              ) : resource.type === 'video' && resource.videoUrl ? (
                                <><PlayCircle className="w-3.5 h-3.5" /> Смотреть видео</>
                              ) : (
                                <><Download className="w-3.5 h-3.5" /> Скачать</>
                              )}
                            </button>
                            {resource.excelFilename && (
                              <a
                                href={`/baza/${resource.excelFilename}`}
                                download
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Скачать шаблон
                              </a>
                            )}
                            {resource.type === 'video' && resource.videoUrl && (
                              <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 px-2 py-1 rounded-full">
                                <ExternalLink className="w-3 h-3" />
                                Внешний источник
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Help block */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-primary-50 dark:bg-primary-950/30 rounded-xl flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-4.5 h-4.5 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="flex-grow">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Нужна помощь?</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
              Если у вас возникли вопросы по работе с системой или нужна дополнительная информация,
              обратитесь в службу поддержки.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl px-3.5 py-3 border border-gray-100 dark:border-gray-700">
                <Mail className="w-4 h-4 text-primary-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 dark:text-gray-500 uppercase font-medium">Email</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">SobirovTT@puvao.mos.ru</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl px-3.5 py-3 border border-gray-100 dark:border-gray-700">
                <Clock className="w-4 h-4 text-primary-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 uppercase font-medium">Время работы</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Пн–Пт, 9:00–17:00</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Knowledge;
