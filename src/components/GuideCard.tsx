import React, { useState } from 'react';
import type { Guide } from '../pages/MainPage';
import { sendCardViewEvent, sendCardClickEvent } from '../services/analytics';
import GuideModal from './GuideModal';

interface GuideCardProps {
  guide: Guide;
}

const GuideCard: React.FC<GuideCardProps> = ({ guide }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  React.useEffect(() => {
    // Отправляем событие просмотра карточки при монтировании
    sendCardViewEvent(guide.id, guide.title, guide.category);
  }, [guide.id, guide.title, guide.category]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Легко': return 'bg-green-500';
      case 'Средне': return 'bg-yellow-500';
      case 'Сложно': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Выживание': 'bg-blue-500',
      'Исследование': 'bg-purple-500',
      'Бой': 'bg-red-500',
      'Крафтинг': 'bg-yellow-500',
      'Экономика': 'bg-green-500',
      'Достижения': 'bg-pink-500',
    };
    return colors[category] || 'bg-gray-500';
  };

  const handleClick = () => {
    sendCardClickEvent(guide.id, guide.title, guide.category);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="group relative bg-gray-800/50 backdrop-blur-sm rounded-2xl overflow-hidden border border-gray-700 hover:border-cyan-500 transition-all duration-500 hover:shadow-2xl hover:shadow-cyan-900/30">
      {/* Эффект при наведении */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 via-cyan-500/0 to-purple-500/0 group-hover:from-cyan-500/10 group-hover:via-cyan-500/5 group-hover:to-purple-500/10 transition-all duration-500" />

      {/* Изображение */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={guide.imageUrl}
          alt={guide.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent" />

        {/* Бейджи поверх изображения */}
        <div className="absolute top-4 left-4 flex gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getDifficultyColor(guide.difficulty)}`}>
            {guide.difficulty}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getCategoryColor(guide.category)}`}>
            {guide.category}
          </span>
        </div>

        {/* Время чтения */}
        <div className="absolute top-4 right-4 bg-gray-900/80 backdrop-blur-sm px-3 py-1 rounded-full text-sm">
          ⏱️ {guide.readTime}
        </div>
      </div>

      {/* Контент */}
      <div className="p-6 relative">
        <h3 className="text-xl font-bold font-heading mb-3 group-hover:text-cyan-300 transition-colors duration-300">
          {guide.title}
        </h3>
        <p className="text-gray-400 mb-4 line-clamp-3">
          {guide.description}
        </p>

        {/* Кнопка чтения */}
        <button onClick={handleClick} className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/30 w-full mt-4">
          Читать гайд →
        </button>

        {/* Прогресс чтения (заглушка) */}
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-500 mb-1">
            <span>Прогресс чтения</span>
            <span>0%</span>
          </div>
          <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 w-0 group-hover:w-1/3 transition-all duration-1000" />
          </div>
        </div>
      </div>

      {/* Индикатор нового (для демонстрации) */}
      {guide.id <= 2 && (
        <div className="absolute -top-2 -right-2">
          <span className="relative flex h-8 w-8">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-8 w-8 bg-gradient-to-r from-cyan-500 to-purple-500 items-center justify-center text-xs font-bold">
              NEW
            </span>
          </span>
        </div>
      )}

      {/* Модальное окно гайда */}
      <GuideModal
        guide={guide}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
};

export default GuideCard;