import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare, Monitor, Building2, Home, BarChart3,
  Camera, AlertTriangle, BrainCircuit, BookOpen,
  Table, Bot, ExternalLink, ChevronRight, Shield,
  HelpCircle, ChevronDown, LineChart, Archive, ListChecks, ClipboardList,
} from 'lucide-react';
import { User } from '../types';

interface DashboardProps {
  user: User;
}

const reportTypes = [
  {
    id: 'our-city',
    title: "Портал «Наш Город»",
    description: "Мониторинг обращений граждан через портал",
    icon: MessageSquare,
    iconClass: 'bg-violet-100 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400',
  },
  {
    id: 'mayor-monitor',
    title: 'Монитор Мэра',
    description: "Отслеживание обращений через систему мониторинга",
    icon: Monitor,
    iconClass: 'bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400',
  },
  {
    id: 'prefect',
    title: 'Кабинет Префекта',
    description: 'Контроль обращений личного кабинета Префекта',
    icon: Building2,
    iconClass: 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400',
  },
  {
    id: 'mzhi',
    title: 'Сообщения МЖИ',
    description: 'Контроль обращений в работе от МЖИ',
    icon: Home,
    iconClass: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'mzhi-statistics',
    title: 'Статистика МЖИ',
    description: 'Статистика нарушений за отчётный период',
    icon: BarChart3,
    iconClass: 'bg-teal-100 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400',
  },
  {
    id: 'tsafap',
    title: 'Нарушения ЦАФАП',
    description: 'Ежедневная сводка нарушений ЦАФАП',
    icon: Camera,
    iconClass: 'bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400',
    prefectOnly: true,
  },
  {
    id: 'oati',
    title: 'Нарушения ОАТИ',
    description: 'Ежедневная сводка нарушений ОАТИ',
    icon: AlertTriangle,
    iconClass: 'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400',
    prefectOnly: true,
  },
  {
    id: 'bot-transfers',
    title: 'Заявки на перенос',
    description: 'Все заявки через бота-согласователя: статусы, районы, причины отказа',
    icon: ClipboardList,
    iconClass: 'bg-pink-100 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400',
  },
] as const;

const additionalSections = [
  {
    id: 'scripts',
    title: 'Скрипты',
    description: 'Готовые ответы на обращения граждан с системой фильтрации',
    icon: BrainCircuit,
    iconClass: 'bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400',
    type: 'internal' as const,
    url: undefined as string | undefined,
  },
  {
    id: 'knowledge',
    title: 'База знаний',
    description: 'Обучающие материалы и полезная информация',
    icon: BookOpen,
    iconClass: 'bg-cyan-100 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400',
    type: 'internal' as const,
    url: undefined as string | undefined,
  },
  {
    id: 'kgh-table',
    title: 'Таблица КГХ',
    description: 'Ситуация по сообщениям КГХ в реальном времени',
    icon: Table,
    iconClass: 'bg-green-100 dark:bg-green-950/50 text-green-600 dark:text-green-400',
    type: 'external' as const,
    url: 'https://docs.google.com/spreadsheets/d/1aiwbR2KdnooBmsR_-Qf9jahYEb2fyjjz29WOU8Xuq0s/edit?gid=0#gid=0',
  },
  {
    id: 'transfer-bot',
    title: 'Бот по переносам',
    description: 'Согласование переносов сроков сообщений',
    icon: Bot,
    iconClass: 'bg-pink-100 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400',
    type: 'external' as const,
    url: 'https://web.tdm.mos.ru/user/-3184800957815138',
  },
];

const analyticsSections = [
  {
    id: 'archive',
    title: 'Архив отчётов',
    description: 'Исторические данные для аналитики',
    icon: Archive,
    iconClass: 'bg-violet-100 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400',
    prefectOnly: true,
  },
  {
    id: 'dashboard',
    title: 'Дашборд ММ',
    description: 'Визуализация и статистика Монитора Мэра',
    icon: LineChart,
    iconClass: 'bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400',
    prefectOnly: false,
  },
  {
    id: 'transfer-statistics',
    title: 'Статистика переносов',
    description: 'Сравнение переносов через бота и фактических',
    icon: BarChart3,
    iconClass: 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400',
    prefectOnly: true,
  },
  {
    id: 'ng-overdue',
    title: 'Дашборд НГ',
    description: 'Сообщения НГ в работе, день по правилу 8 дней и статус устранения',
    icon: ListChecks,
    iconClass: 'bg-violet-100 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400',
    prefectOnly: false,
  },
];

const faqItems = [
  {
    question: 'Как скачать отчёт в формате Excel?',
    answer: 'В каждом разделе отчётов есть кнопка «Скачать Excel». Нажмите на неё, чтобы загрузить актуальный отчёт.',
  },
  {
    question: 'Как часто обновляются данные?',
    answer: 'Данные обновляются автоматически каждый час или каждые два часа. Время последнего обновления указано в каждом отчёте.',
  },
  {
    question: 'Отчёт показывает неправильные данные, что делать?',
    answer: 'Отчёты формируются через выгрузку с портала «Наш город» и АРМ Префектур. Если данные неверны, это проблемы с их стороны.',
  },
  {
    question: 'Время обновления отчёта было очень давно, почему?',
    answer: "Часто это связано с проблемами на стороне АРМ Префектур или портала «Наш город». Могут наблюдаться сбои в работе, задержки и другие неполадки.",
  },
  {
    question: "Для чего нужна вкладка «База знаний»?",
    answer: "База знаний предназначена для ознакомления с различными работами: актуализация парков, создание отчётов, инструкции и т.д.",
  },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800/80 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors gap-4"
      >
        <span className="font-medium text-gray-900 dark:text-white text-sm leading-snug">{question}</span>
        <ChevronDown
          className={`w-4.5 h-4.5 text-gray-400 flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-primary-500' : ''}`}
        />
      </button>
      {open && (
        <div className="px-5 pb-4 pt-0 text-sm text-gray-600 dark:text-gray-400 leading-relaxed border-t border-gray-100 dark:border-gray-800/80 animate-fade-in">
          <div className="pt-3">{answer}</div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ label, icon: Icon }: { label: string; icon?: React.ComponentType<{ className?: string; size?: number }> }) {
  return (
    <div className="flex items-center gap-2.5 mb-5">
      {Icon && <Icon size={18} className="text-primary-500 dark:text-primary-400 flex-shrink-0" />}
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">{label}</h2>
      <div className="flex-1 h-px bg-gradient-to-r from-gray-200 dark:from-gray-700 to-transparent ml-1" />
    </div>
  );
}

function Dashboard({ user }: DashboardProps) {
  const isAdmin = !!user.is_admin;

  return (
    <div className="space-y-8 animate-fade-in">

      {/* ─── Hero ───────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-primary-700 to-[#3730a3] text-white shadow-xl">
        {/* Decorative blobs */}
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute -bottom-20 -left-16 w-72 h-72 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute top-1/2 right-1/3 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />

        <div className="relative p-6 sm:p-8">
          {isAdmin && (
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/15 hover:bg-white/25 border border-white/20 rounded-full text-xs font-semibold mb-5 transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              Открыть Админ-панель
              <ChevronRight className="w-3 h-3" />
            </Link>
          )}

          <h1 className="text-2xl sm:text-3xl font-bold mb-2 leading-tight">
            Информационная система Префектуры ЮВАО
          </h1>
          <p className="text-primary-100/80 text-sm sm:text-base max-w-xl leading-relaxed">
            Отчёты, аналитика и база знаний в одном месте.
          </p>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <div className="bg-white/15 border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-medium">
              {user.name}
            </div>
            <div className="bg-white/15 border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-medium">
              {user.organization}
            </div>
            {user.duty && (
              <div className="bg-white/15 border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-medium">
                {user.duty}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Reports ────────────────────────────────────────── */}
      <section>
        <SectionHeader label="Отчёты" />
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {reportTypes
            .filter(r => !(r.prefectOnly && user.duty !== 'Префектура'))
            .map(report => (
              <Link
                key={report.id}
                to={`/report/${report.id}`}
                className="group relative flex flex-col gap-3 p-4 sm:p-5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
              >
                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-primary-50/70 to-transparent dark:from-primary-950/25" />

                {/* Icon row */}
                <div className="relative flex items-start justify-between">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300 ${report.iconClass}`}>
                    <report.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl border border-gray-100 dark:border-gray-700/80 flex items-center justify-center group-hover:border-primary-200 dark:group-hover:border-primary-800 group-hover:bg-primary-50 dark:group-hover:bg-primary-950/40 transition-all duration-200">
                    <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all duration-200" />
                  </div>
                </div>

                {/* Text */}
                <div className="relative">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm leading-snug mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {report.title}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2 hidden sm:block">
                    {report.description}
                  </p>
                </div>
              </Link>
            ))}
        </div>
      </section>

      {/* ─── Tools + Analytics ──────────────────────────────── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">

        <section>
          <SectionHeader label="Инструменты и ресурсы" />
          <div className="space-y-3">
            {additionalSections.map(section => {
              const inner = (
                <>
                  <div className={`p-2.5 rounded-xl flex-shrink-0 group-hover:scale-110 transition-transform duration-300 ${section.iconClass}`}>
                    <section.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {section.title}
                      </h3>
                      {section.type === 'external' && (
                        <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{section.description}</p>
                  </div>
                  {section.type === 'internal' && (
                    <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-primary-400 group-hover:translate-x-0.5 transition-all duration-200 flex-shrink-0" />
                  )}
                </>
              );

              if (section.type === 'external') {
                return (
                  <button
                    key={section.id}
                    onClick={() => window.open(section.url!, '_blank', 'noopener,noreferrer')}
                    className="group w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 hover:border-primary-200 dark:hover:border-primary-800/60 hover:shadow-card transition-all duration-300 text-left"
                  >
                    {inner}
                  </button>
                );
              }
              return (
                <Link
                  key={section.id}
                  to={`/${section.id}`}
                  className="group flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 hover:border-primary-200 dark:hover:border-primary-800/60 hover:shadow-card transition-all duration-300"
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        </section>

        <section>
          <SectionHeader label="Аналитика" />
          <div className="space-y-3">
            {analyticsSections
              .filter(section => !section.prefectOnly || user.duty === 'Префектура')
              .map(section => (
                <Link
                  key={section.id}
                  to={`/analytics/${section.id}`}
                  className="group flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 hover:border-primary-200 dark:hover:border-primary-800/60 hover:shadow-card transition-all duration-300"
                >
                  <div className={`p-2.5 rounded-xl flex-shrink-0 group-hover:scale-110 transition-transform duration-300 ${section.iconClass}`}>
                    <section.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {section.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{section.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-primary-400 group-hover:translate-x-0.5 transition-all duration-200 flex-shrink-0" />
                </Link>
              ))}
          </div>
        </section>
      </div>

      {/* ─── FAQ ────────────────────────────────────────────── */}
      <section className="pb-4">
        <SectionHeader label="Часто задаваемые вопросы" icon={HelpCircle} />
        <div className="space-y-2">
          {faqItems.map((item, i) => (
            <FAQItem key={i} question={item.question} answer={item.answer} />
          ))}
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
