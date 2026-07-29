import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface PolicyViewerProps {
  type: 'agreement' | 'privacy';
}

function PolicyViewer({ type }: PolicyViewerProps) {
  const titles = {
    agreement: 'Пользовательское соглашение',
    privacy: 'Политика конфиденциальности'
  };

  const files = {
    agreement: '/Agreement.pdf',
    privacy: '/Privacy.pdf'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/"
          className="p-2 text-gray-600 hover:text-purple-800 rounded-full hover:bg-purple-50"
        >
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{titles[type]}</h1>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 min-h-[800px]">
        <object
          data={files[type]}
          type="application/pdf"
          className="w-full h-[800px]"
        >
          <p>
            PDF не может быть отображен.{' '}
            <a
              href={files[type]}
              download
              className="text-purple-600 hover:text-purple-800"
            >
              Скачать PDF
            </a>
          </p>
        </object>
      </div>
    </div>
  );
}

export default PolicyViewer;