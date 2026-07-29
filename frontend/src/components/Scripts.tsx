import { useState, useEffect, useMemo } from 'react';
import { Script, ScriptFilter, ExcelRow } from '../types';
import {
  Search, X, Copy, Check, ChevronRight,
  FileText, AlertCircle, RotateCcw, BookOpen,
} from 'lucide-react';

function useCopy() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };
  return { copiedId, copy };
}

interface FilterStepProps {
  step: number;
  label: string;
  options: string[];
  value: string;
  onSelect: (v: string) => void;
}

function FilterStep({ step, label, options, value, onSelect }: FilterStepProps) {
  const [query, setQuery] = useState('');
  const visible = query
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 last:border-0 p-4 sm:p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-5 h-5 rounded-full bg-primary-600 dark:bg-primary-500 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 select-none">
          {step}
        </span>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{label}</span>
        {value && (
          <span className="ml-auto flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 font-medium">
            <Check className="w-3 h-3" />
            {value}
          </span>
        )}
      </div>

      {options.length > 8 && (
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Найти..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-primary-400 text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {visible.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onSelect(opt === value ? '' : opt)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150 ${
              opt === value
                ? 'bg-primary-600 dark:bg-primary-500 text-white shadow-sm scale-[1.02]'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 hover:scale-[1.02]'
            }`}
          >
            {opt}
          </button>
        ))}
        {visible.length === 0 && (
          <span className="text-sm text-gray-400 dark:text-gray-500">Ничего не найдено</span>
        )}
      </div>
    </div>
  );
}

interface ScriptCardProps {
  script: Script;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
}

function ScriptCard({ script, copiedId, onCopy }: ScriptCardProps) {
  const copyId = `resp-${script.id}`;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      {/* Card header */}
      <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
        <div className="w-6 h-6 bg-primary-100 dark:bg-primary-950/50 rounded-md flex items-center justify-center flex-shrink-0">
          <FileText className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">ID:</span>
        <span className="text-sm font-bold text-gray-900 dark:text-white">{script.id}</span>
        {script.status && (
          <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/50">
            {script.status}
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-xs flex-wrap">
          <span className="font-semibold text-gray-700 dark:text-gray-300">{script.controlObject}</span>
          {script.problem && (
            <>
              <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <span className="text-gray-500 dark:text-gray-400">{script.problem}</span>
            </>
          )}
          {script.work && (
            <>
              <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <span className="text-gray-500 dark:text-gray-400">{script.work}</span>
            </>
          )}
        </div>

        {/* Response block — always fully visible */}
        {script.response && (
          <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700/50 overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-gray-700/50">
              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Текст ответа ОИВ
              </span>
              <button
                type="button"
                onClick={() => onCopy(script.response, copyId)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  copiedId === copyId
                    ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                    : 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/50'
                }`}
              >
                {copiedId === copyId
                  ? <><Check className="w-3 h-3" /> Скопировано</>
                  : <><Copy className="w-3 h-3" /> Скопировать</>
                }
              </button>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-gray-800 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {script.response}
              </p>
            </div>
          </div>
        )}

        {/* Extra info — always visible */}
        {(script.documents || script.notes || script.category) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {script.category && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
                  Категория
                </p>
                <p className="text-sm text-gray-800 dark:text-gray-300">{script.category}</p>
              </div>
            )}
            {script.documents && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
                  Документы / акты
                </p>
                <p className="text-sm text-gray-800 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{script.documents}</p>
              </div>
            )}
            {script.notes && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
                  Примечания
                </p>
                <p className="text-sm text-gray-800 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{script.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 overflow-hidden animate-pulse">
      <div className="h-11 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800" />
      <div className="p-5 space-y-3">
        <div className="h-3 w-2/3 bg-gray-100 dark:bg-gray-800 rounded-full" />
        <div className="h-20 bg-gray-50 dark:bg-gray-800/60 rounded-xl" />
      </div>
    </div>
  );
}

const SHOW_STEP = 30;

function Scripts() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<ScriptFilter>({
    controlObject: '',
    status: '',
    problem: '',
    work: '',
  });
  const [visibleCount, setVisibleCount] = useState(SHOW_STEP);
  const { copiedId, copy } = useCopy();

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await fetch('/files/f1scripta.xlsx');
        if (!resp.ok) throw new Error('not found');
        const buf = await resp.arrayBuffer();
        const { read, utils } = await import('xlsx');
        const wb = read(buf);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = utils.sheet_to_json<ExcelRow>(ws, { raw: false });
        setScripts(data.map(row => ({
          id: row['ID заявки'],
          controlObject: row['Объект контроля'],
          category: row['Категория'],
          problem: row['Проблема'],
          status: row['Статус'],
          work: row['Работы на объекте'],
          response: row['Текст ответа ОИВ'],
          documents: row['Документы/акты'],
          notes: row['Примечания'],
        })));
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const options = useMemo(() => {
    const sort = (arr: string[]) => [...arr].sort((a, b) => a.localeCompare(b, 'ru'));

    const controlObjects = sort([...new Set(scripts.map(s => s.controlObject))].filter(Boolean));

    const afterObj = filters.controlObject
      ? scripts.filter(s => s.controlObject === filters.controlObject)
      : scripts;
    const statuses = sort([...new Set(afterObj.map(s => s.status))].filter(Boolean));

    const afterSt = filters.status
      ? afterObj.filter(s => s.status === filters.status)
      : afterObj;
    const problems = sort([...new Set(afterSt.map(s => s.problem))].filter(Boolean));

    const afterPr = filters.problem
      ? afterSt.filter(s => s.problem === filters.problem)
      : afterSt;
    const works = sort([...new Set(afterPr.map(s => s.work))].filter(Boolean));

    return { controlObjects, statuses, problems, works };
  }, [scripts, filters.controlObject, filters.status, filters.problem]);

  const results = useMemo(() => {
    let f = scripts;
    if (filters.controlObject) f = f.filter(s => s.controlObject === filters.controlObject);
    if (filters.status)        f = f.filter(s => s.status === filters.status);
    if (filters.problem)       f = f.filter(s => s.problem === filters.problem);
    if (filters.work)          f = f.filter(s => s.work === filters.work);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      f = f.filter(s =>
        s.response?.toLowerCase().includes(q) ||
        s.problem?.toLowerCase().includes(q) ||
        s.controlObject?.toLowerCase().includes(q) ||
        s.id?.toLowerCase().includes(q) ||
        s.notes?.toLowerCase().includes(q) ||
        s.work?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q)
      );
    }
    return f;
  }, [scripts, filters, searchQuery]);

  const setFilter = (key: keyof ScriptFilter, value: string) => {
    const order: (keyof ScriptFilter)[] = ['controlObject', 'status', 'problem', 'work'];
    const idx = order.indexOf(key);
    const next = { ...filters, [key]: value };
    for (let i = idx + 1; i < order.length; i++) next[order[i]] = '';
    setFilters(next);
    setVisibleCount(SHOW_STEP);
  };

  const reset = () => {
    setFilters({ controlObject: '', status: '', problem: '', work: '' });
    setSearchQuery('');
    setVisibleCount(SHOW_STEP);
  };

  const hasFilters = Object.values(filters).some(Boolean) || searchQuery;
  const showResults = !!(filters.controlObject || searchQuery);

  const plural = (n: number) => {
    if (n % 10 === 1 && n % 100 !== 11) return 'скрипт';
    if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 'скрипта';
    return 'скриптов';
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Скрипты ответов</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Готовые ответы на обращения граждан
          </p>
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Сбросить всё
          </button>
        )}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setVisibleCount(SHOW_STEP); }}
          placeholder="Поиск по тексту ответа, проблеме, объекту, работам, ID..."
          className="w-full pl-11 pr-10 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500 transition-colors shadow-sm"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => { setSearchQuery(''); setVisibleCount(SHOW_STEP); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Warning banner */}
      <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-100 dark:border-amber-900/50">
        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
          Внимательно ознакомьтесь с содержанием ответа — названия документов, адресов и организаций
          заменены на общие (например, «ООО Ромашка»).
        </p>
      </div>

      {/* Cascading step filters */}
      {loading ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 p-5 animate-pulse">
          <div className="h-4 w-48 bg-gray-100 dark:bg-gray-800 rounded-full mb-4" />
          <div className="flex flex-wrap gap-2">
            {[120, 90, 150, 80, 110, 95].map(w => (
              <div key={w} className="h-8 rounded-xl bg-gray-100 dark:bg-gray-800" style={{ width: w }} />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-14 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 gap-3">
          <div className="w-12 h-12 bg-red-50 dark:bg-red-950/30 rounded-2xl flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Не удалось загрузить файл скриптов
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Убедитесь, что файл f1scripta.xlsx находится в папке frontend/public/files/
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 overflow-hidden">
          <FilterStep
            step={1}
            label="Объект контроля"
            options={options.controlObjects}
            value={filters.controlObject}
            onSelect={v => setFilter('controlObject', v)}
          />
          {filters.controlObject && (
            <FilterStep
              step={2}
              label="Статус"
              options={options.statuses}
              value={filters.status}
              onSelect={v => setFilter('status', v)}
            />
          )}
          {filters.status && (
            <FilterStep
              step={3}
              label="Проблема"
              options={options.problems}
              value={filters.problem}
              onSelect={v => setFilter('problem', v)}
            />
          )}
          {filters.problem && (
            <FilterStep
              step={4}
              label="Работы на объекте"
              options={options.works}
              value={filters.work}
              onSelect={v => setFilter('work', v)}
            />
          )}
        </div>
      )}

      {/* Results */}
      {showResults && !loading && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between px-1">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Найдено:{' '}
              <span className="font-bold text-primary-600 dark:text-primary-400">
                {results.length}
              </span>{' '}
              {plural(results.length)}
              {results.length > visibleCount && (
                <span className="text-gray-400 dark:text-gray-500">
                  {' '}· показано {visibleCount}
                </span>
              )}
            </p>
          </div>

          {results.length > 0 ? (
            <>
              {results.slice(0, visibleCount).map(script => (
                <ScriptCard
                  key={script.id}
                  script={script}
                  copiedId={copiedId}
                  onCopy={copy}
                />
              ))}
              {results.length > visibleCount && (
                <button
                  type="button"
                  onClick={() => setVisibleCount(v => v + SHOW_STEP)}
                  className="w-full py-3 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-primary-400 dark:hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  Показать ещё {Math.min(SHOW_STEP, results.length - visibleCount)} из {results.length - visibleCount} оставшихся
                </button>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 gap-3">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                По выбранным фильтрам ничего не найдено
              </p>
              <button
                type="button"
                onClick={reset}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                Сбросить фильтры
              </button>
            </div>
          )}
        </div>
      )}

      {/* Idle state */}
      {!showResults && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
          <div className="w-14 h-14 bg-primary-50 dark:bg-primary-950/30 rounded-2xl flex items-center justify-center">
            <Search className="w-7 h-7 text-primary-400 dark:text-primary-500" />
          </div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Выберите объект контроля выше или введите запрос в поиск
          </p>
        </div>
      )}
    </div>
  );
}

export default Scripts;
