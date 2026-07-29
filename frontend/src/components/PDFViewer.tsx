import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  Download, Maximize, Minimize, AlertCircle, Columns,
} from 'lucide-react';

const isDev = import.meta.env.DEV;
pdfjs.GlobalWorkerOptions.workerSrc = isDev
  ? `/pdf-cdn/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`
  : `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface PDFViewerProps {
  url: string | null;
  title?: string;
}

function Divider() {
  return <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-0.5 flex-shrink-0" />;
}

interface IBtnProps {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  title?: string;
  children: React.ReactNode;
}

function IBtn({ onClick, disabled, active, title, children }: IBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150
        disabled:opacity-35 disabled:cursor-not-allowed active:scale-90 flex-shrink-0
        ${active
          ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200'
        }`}
    >
      {children}
    </button>
  );
}

const PDFViewer: React.FC<PDFViewerProps> = ({ url, title = 'PDF Документ' }) => {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [renderScale, setRenderScale] = useState(1.5);
  const [cssScale, setCssScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [fitToWidth, setFitToWidth] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Refs for stable closure access
  const cssScaleRef = useRef(1);
  const renderScaleRef = useRef(1.5);
  const zoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageNumberRef = useRef(1);
  const numPagesRef = useRef(0);
  const isFullScreenRef = useRef(false);
  const fitToWidthRef = useRef(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const scrollStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchInitDist = useRef<number | null>(null);
  const touchInitScale = useRef(1);

  useEffect(() => { renderScaleRef.current = renderScale; }, [renderScale]);
  useEffect(() => { pageNumberRef.current = pageNumber; }, [pageNumber]);
  useEffect(() => { numPagesRef.current = numPages; }, [numPages]);
  useEffect(() => { isFullScreenRef.current = isFullScreen; }, [isFullScreen]);
  useEffect(() => { fitToWidthRef.current = fitToWidth; }, [fitToWidth]);

  const calcFitScale = useCallback((): number => {
    if (!containerRef.current) return 1;
    return Math.max(0.5, (containerRef.current.clientWidth - 48) / 595);
  }, []);

  // Auto-scale on mount + resize
  useEffect(() => {
    const update = () => {
      if (fitToWidthRef.current) {
        const s = calcFitScale();
        setRenderScale(s); renderScaleRef.current = s;
        return;
      }
      const w = window.innerWidth;
      const s = w < 640
        ? Math.min((w - 48) / 595, 1)
        : w < 768
          ? Math.min((w - 96) / 595, 1.2)
          : w < 1024 ? 1.2 : 1.5;
      setRenderScale(s); renderScaleRef.current = s;
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [calcFitScale]);

  // ── Smooth zoom: instant CSS feedback → debounced PDF re-render ──
  const applyZoom = useCallback((factor: number) => {
    const effective = renderScaleRef.current * cssScaleRef.current;
    const target = Math.max(0.5, Math.min(3, effective * factor));
    const newCss = target / renderScaleRef.current;
    setCssScale(newCss);
    cssScaleRef.current = newCss;

    if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
    zoomTimerRef.current = setTimeout(() => {
      const container = containerRef.current;
      const scrollRatio = container ? container.scrollTop / (container.scrollHeight || 1) : 0;

      const final = Math.max(0.5, Math.min(3, renderScaleRef.current * cssScaleRef.current));
      setRenderScale(final); renderScaleRef.current = final;
      setCssScale(1); cssScaleRef.current = 1;
      setFitToWidth(false); fitToWidthRef.current = false;

      requestAnimationFrame(() => {
        if (container) container.scrollTop = scrollRatio * container.scrollHeight;
      });
    }, 300);
  }, []);

  const resetZoom = useCallback(() => {
    if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
    const w = window.innerWidth;
    const s = w < 640
      ? Math.min((w - 48) / 595, 1)
      : w < 768 ? Math.min((w - 96) / 595, 1.2)
      : w < 1024 ? 1.2 : 1.5;
    setRenderScale(s); renderScaleRef.current = s;
    setCssScale(1); cssScaleRef.current = 1;
    setFitToWidth(false); fitToWidthRef.current = false;
  }, []);

  const toggleFitToWidth = useCallback(() => {
    const next = !fitToWidthRef.current;
    fitToWidthRef.current = next;
    setFitToWidth(next);
    if (next) {
      if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
      const s = calcFitScale();
      setRenderScale(s); renderScaleRef.current = s;
      setCssScale(1); cssScaleRef.current = 1;
    }
  }, [calcFitScale]);

  const toggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullScreen(true); isFullScreenRef.current = true;
    } else {
      document.exitFullscreen?.();
      setIsFullScreen(false); isFullScreenRef.current = false;
    }
  }, []);

  const downloadPDF = useCallback(() => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url; a.download = `${title}.pdf`; a.target = '_blank';
    a.click();
  }, [url, title]);

  const scrollToPage = useCallback((n: number) => {
    pageRefs.current.get(n)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setPageNumber(n); pageNumberRef.current = n;
  }, []);

  const scrollToNextPage = useCallback(() => {
    const next = pageNumberRef.current + 1;
    if (next <= numPagesRef.current) scrollToPage(next);
  }, [scrollToPage]);

  const scrollToPrevPage = useCallback(() => {
    const prev = pageNumberRef.current - 1;
    if (prev >= 1) scrollToPage(prev);
  }, [scrollToPage]);

  const changePage = useCallback((offset: number) => {
    const n = Math.max(1, Math.min(pageNumberRef.current + offset, numPagesRef.current));
    scrollToPage(n);
  }, [scrollToPage]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') && !e.ctrlKey) {
        e.preventDefault(); scrollToNextPage();
      } else if ((e.key === 'ArrowUp' || e.key === 'PageUp') && !e.ctrlKey) {
        e.preventDefault(); scrollToPrevPage();
      } else if (e.key === 'ArrowRight' && e.shiftKey) {
        e.preventDefault(); containerRef.current?.scrollBy({ left: 200, behavior: 'smooth' });
      } else if (e.key === 'ArrowLeft' && e.shiftKey) {
        e.preventDefault(); containerRef.current?.scrollBy({ left: -200, behavior: 'smooth' });
      } else if ((e.key === '+' || e.key === '=') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault(); applyZoom(1.2);
      } else if (e.key === '-' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault(); applyZoom(1 / 1.2);
      } else if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault(); resetZoom();
      } else if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault(); toggleFullScreen();
      } else if (e.key === 'w' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault(); toggleFitToWidth();
      } else if (e.key === 'Escape' && isFullScreenRef.current) {
        document.exitFullscreen?.();
        setIsFullScreen(false); isFullScreenRef.current = false;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scrollToNextPage, scrollToPrevPage, applyZoom, resetZoom, toggleFullScreen, toggleFitToWidth]);

  const onDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
    setNumPages(n); numPagesRef.current = n;
    setPageNumber(1); pageNumberRef.current = 1;
    setLoading(false);
    setTimeout(() => {
      if (fitToWidthRef.current) {
        const s = calcFitScale();
        setRenderScale(s); renderScaleRef.current = s;
      }
    }, 100);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error('PDF load error:', err);
    setError('Не удалось загрузить PDF документ');
    setLoading(false);
  };

  // Page tracking via scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container || numPages === 0) return;
    const onScroll = () => {
      const cr = container.getBoundingClientRect();
      const center = cr.top + cr.height / 2;
      let closest = 1, minDist = Infinity;
      pageRefs.current.forEach((el, n) => {
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - center);
        if (d < minDist) { minDist = d; closest = n; }
      });
      if (closest !== pageNumberRef.current) {
        setPageNumber(closest); pageNumberRef.current = closest;
      }
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [numPages]);

  // Ctrl+wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        applyZoom(e.deltaY > 0 ? 1 / 1.08 : 1.08);
      } else if (e.shiftKey) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [applyZoom]);

  // Middle-button drag
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onDown = (e: MouseEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      scrollStartRef.current = { x: container.scrollLeft, y: container.scrollTop };
      setIsDragging(true);
    };
    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !dragStartRef.current || !scrollStartRef.current) return;
      container.scrollLeft = scrollStartRef.current.x - (e.clientX - dragStartRef.current.x);
      container.scrollTop = scrollStartRef.current.y - (e.clientY - dragStartRef.current.y);
    };
    const onUp = () => {
      isDraggingRef.current = false;
      dragStartRef.current = null;
      scrollStartRef.current = null;
      setIsDragging(false);
    };
    container.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      container.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // Pinch-to-zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        touchInitDist.current = dist(e.touches);
        touchInitScale.current = renderScaleRef.current * cssScaleRef.current;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || touchInitDist.current === null) return;
      e.preventDefault();
      const ratio = dist(e.touches) / touchInitDist.current;
      const target = Math.max(0.5, Math.min(3, touchInitScale.current * ratio));
      const newCss = target / renderScaleRef.current;
      setCssScale(newCss); cssScaleRef.current = newCss;

      if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
      zoomTimerRef.current = setTimeout(() => {
        const final = Math.max(0.5, Math.min(3, renderScaleRef.current * cssScaleRef.current));
        setRenderScale(final); renderScaleRef.current = final;
        setCssScale(1); cssScaleRef.current = 1;
        setFitToWidth(false); fitToWidthRef.current = false;
      }, 350);
    };
    const onEnd = () => { touchInitDist.current = null; };

    container.addEventListener('touchstart', onStart, { passive: true });
    container.addEventListener('touchmove', onMove, { passive: false });
    container.addEventListener('touchend', onEnd);
    return () => {
      container.removeEventListener('touchstart', onStart);
      container.removeEventListener('touchmove', onMove);
      container.removeEventListener('touchend', onEnd);
    };
  }, []);

  // ── No URL ────────────────────────────────────────────────────────
  if (!url) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
        <div className="text-center text-gray-400 dark:text-gray-500">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">PDF файл не найден</p>
        </div>
      </div>
    );
  }

  const effectivePct = Math.round(renderScale * cssScale * 100);
  const progress = numPages > 0 ? pageNumber / numPages : 0;

  return (
    <div
      className={`relative flex flex-col bg-white dark:bg-gray-900 overflow-hidden
        ${isFullScreen
          ? 'fixed inset-0 z-50'
          : 'rounded-2xl border border-gray-100 dark:border-gray-800 shadow-card'
        }`}
    >
      <style>{`:root{--pdf-bg:#eaecef}.dark{--pdf-bg:#111118}`}</style>

      {/* ── Toolbar ────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-2 sm:px-3 py-2 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800/80 select-none flex-shrink-0">

        {/* Page nav */}
        <IBtn onClick={() => changePage(-1)} disabled={pageNumber <= 1} title="Предыдущая (↑ / PageUp)">
          <ChevronLeft size={16} />
        </IBtn>

        <div className="flex items-center gap-1 px-2 h-8 bg-gray-50 dark:bg-gray-800/80 rounded-lg border border-gray-200 dark:border-gray-700 flex-shrink-0">
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums leading-none">
            {pageNumber}
          </span>
          <span className="text-xs text-gray-400 leading-none">/</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums leading-none">
            {numPages || '–'}
          </span>
        </div>

        <IBtn onClick={() => changePage(1)} disabled={pageNumber >= numPages} title="Следующая (↓ / PageDown)">
          <ChevronRight size={16} />
        </IBtn>

        <Divider />

        {/* Zoom */}
        <IBtn
          onClick={() => applyZoom(1 / 1.2)}
          disabled={renderScale * cssScale <= 0.5}
          title="Уменьшить (Ctrl −)"
        >
          <ZoomOut size={16} />
        </IBtn>

        <button
          onClick={resetZoom}
          title="Сбросить масштаб (Ctrl 0)"
          className="h-8 px-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700
            text-xs font-semibold text-gray-700 dark:text-gray-300
            hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors tabular-nums min-w-[52px] text-center flex-shrink-0"
        >
          {effectivePct}%
        </button>

        <IBtn
          onClick={() => applyZoom(1.2)}
          disabled={renderScale * cssScale >= 3}
          title="Увеличить (Ctrl +)"
        >
          <ZoomIn size={16} />
        </IBtn>

        <IBtn onClick={toggleFitToWidth} active={fitToWidth} title="По ширине (Ctrl W)">
          <Columns size={16} />
        </IBtn>

        <Divider />

        {/* Actions */}
        <IBtn
          onClick={toggleFullScreen}
          title={isFullScreen ? 'Выйти из полноэкранного (Esc)' : 'Полноэкранный режим (Ctrl F)'}
        >
          {isFullScreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </IBtn>

        <button
          onClick={downloadPDF}
          title="Скачать PDF"
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary-600 hover:bg-primary-700
            active:scale-95 text-white text-xs font-semibold transition-all duration-150
            shadow-sm flex-shrink-0 ml-0.5"
        >
          <Download size={14} />
          <span className="hidden sm:inline">Скачать</span>
        </button>
      </div>

      {/* ── Progress bar ───────────────────────────────────────── */}
      <div className="h-[2px] bg-gray-100 dark:bg-gray-800 flex-shrink-0">
        <div
          className="h-full bg-primary-500 transition-all duration-500 ease-out"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* ── PDF container ──────────────────────────────────────── */}
      <div
        ref={containerRef}
        className={`overflow-auto flex-1 ${isDragging ? 'cursor-grabbing' : ''}`}
        style={{
          maxHeight: isFullScreen ? '100vh' : 'calc(100vh - 200px)',
          touchAction: 'pan-x pan-y',
          background: 'var(--pdf-bg)',
        }}
      >
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-28 gap-4">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border-[3px] border-gray-200 dark:border-gray-700" />
              <div className="absolute inset-0 rounded-full border-[3px] border-primary-500 border-t-transparent animate-spin" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Загрузка документа…</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex flex-col items-center justify-center py-28 px-4 gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Ошибка загрузки</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{error}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Обновить страницу
            </button>
          </div>
        )}

        {/* Document */}
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
          className="py-5 min-w-full flex flex-col items-center"
        >
          {/* CSS scale wrapper: instant visual feedback while PDF re-renders */}
          <div
            className="flex flex-col items-center"
            style={{
              transform: cssScale !== 1 ? `scale(${cssScale})` : undefined,
              transformOrigin: 'center top',
              willChange: cssScale !== 1 ? 'transform' : 'auto',
            }}
          >
            {numPages > 0 && Array.from({ length: numPages }, (_, i) => (
              <div
                key={`page_${i + 1}`}
                ref={el => { if (el) pageRefs.current.set(i + 1, el); }}
                className="mb-4 last:mb-0"
                style={{ minWidth: 'fit-content' }}
              >
                <Page
                  pageNumber={i + 1}
                  scale={renderScale}
                  className="shadow-2xl rounded-sm overflow-hidden"
                  renderAnnotationLayer
                  renderTextLayer
                  loading=""
                />
              </div>
            ))}
          </div>
        </Document>
      </div>

      {/* ── Mobile nav buttons ─────────────────────────────────── */}
      <div className="md:hidden absolute bottom-16 right-4 z-40 flex flex-col gap-2">
        <button
          onClick={scrollToPrevPage}
          disabled={pageNumber <= 1}
          className="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700
            flex items-center justify-center text-gray-600 dark:text-gray-300
            disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-90"
        >
          <ChevronLeft size={18} className="rotate-90" />
        </button>
        <button
          onClick={scrollToNextPage}
          disabled={pageNumber >= numPages}
          className="w-10 h-10 rounded-xl bg-primary-600 hover:bg-primary-700 shadow-lg
            flex items-center justify-center text-white
            disabled:opacity-40 transition-all active:scale-90"
        >
          <ChevronRight size={18} className="rotate-90" />
        </button>
      </div>

      {/* ── Mobile page indicator ──────────────────────────────── */}
      <div className="md:hidden absolute bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
        <div className="px-3 py-1.5 bg-black/70 backdrop-blur-sm rounded-full text-white text-xs font-medium tabular-nums">
          {pageNumber} / {numPages}
        </div>
      </div>
    </div>
  );
};

export default PDFViewer;
