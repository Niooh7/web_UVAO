import { useState, useEffect } from 'react';

interface FileData {
  pdf?: string;
  xlsx?: string;
}

interface UseReportFilesProps {
  folderName: string;
}

interface UseReportFilesReturn {
  pdfUrl: string | null;
  excelUrl: string | null;
  lastUpdate: string | null;
  loading: boolean;
  error: string | null;
}

export function useReportFiles({ folderName }: UseReportFilesProps): UseReportFilesReturn {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [excelUrl, setExcelUrl] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!folderName) {
      setLoading(false);
      return;
    }

    const fetchFiles = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/files?folder_name=${folderName}`, {
          method: 'GET',
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: FileData = await response.json();

        if (data.pdf) setPdfUrl(`/reports/${folderName}/${data.pdf}`);
        if (data.xlsx) setExcelUrl(`/reports/${folderName}/${data.xlsx}`);

        if (data.pdf || data.xlsx) {
          const latestFileName = data.pdf || data.xlsx;
          const match = latestFileName.match(/ (\d{2}\.\d{2}\.\d{4} \d{2}-\d{2})\./);
          if (match) setLastUpdate(match[1]);
        }
      } catch (err) {
        console.error('Ошибка при загрузке файлов:', err);
        setError('Ошибка загрузки файлов');
        setPdfUrl(null);
        setExcelUrl(null);
        setLastUpdate('Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, [folderName]);

  return { pdfUrl, excelUrl, lastUpdate, loading, error };
}
