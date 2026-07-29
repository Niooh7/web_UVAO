import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, LineChart } from 'lucide-react';
import { User } from '../../types';

interface AnalyticsProps {
  user: User;
}

function Analytics({ user }: AnalyticsProps) {
  const sections = [
    {
      id: 'archive',
      title: 'Архив отчетов',
      description: 'Доступ к историческим данным отчетов для проведения аналитики и отслеживания динамики изменений',
      icon: BarChart3,
      requiresPrefecture: true,
    },
    {
      id: 'dashboard',
      title: 'Дашборд ММ',
      description: 'Визуализация данных и статистика Монитора Мэра по обращениям граждан',
      icon: LineChart,
      requiresPrefecture: true,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Аналитика</h1>
        <p className="text-gray-600">
          Инструменты для анализа данных и отслеживания статистики по различным показателям.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section) => {
          if (!section.requiresPrefecture || user.duty === 'Префектура') {
            return (
              <Link
                key={section.id}
                to={`/analytics/${section.id}`}
                className="block p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4">
                  <section.icon className="w-8 h-8 text-purple-600" />
                  <div>
                    <h3 className="font-medium text-gray-900">{section.title}</h3>
                    <p className="text-sm text-gray-600">{section.description}</p>
                  </div>
                </div>
              </Link>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

export default Analytics;