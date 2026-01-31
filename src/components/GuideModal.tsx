import React from 'react';
import type { Guide } from '../pages/MainPage';

interface GuideModalProps {
  guide: Guide;
  isOpen: boolean;
  onClose: () => void;
}

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

const GuideModal: React.FC<GuideModalProps> = ({ guide, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Затемнение фона */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 transition-opacity duration-300 animate-fade-in"
        onClick={onClose}
      />

      {/* Модальное окно */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <div
          className="relative w-full max-w-2xl bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-cyan-800/30 shadow-2xl shadow-cyan-900/20 overflow-hidden animate-fade-in-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Закрывающий крестик */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 bg-gray-800/80 hover:bg-gray-700/80 rounded-full transition-colors duration-300"
            aria-label="Закрыть"
          >
            <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Изображение гайда */}
          <div className="relative h-56 sm:h-64 overflow-hidden">
            <img
              src={guide.imageUrl}
              alt={guide.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/70 to-transparent" />

            {/* Бейджи поверх изображения */}
            <div className="absolute bottom-4 left-4 flex gap-2">
              <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${getDifficultyColor(guide.difficulty)}`}>
                {guide.difficulty}
              </span>
              <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${getCategoryColor(guide.category)}`}>
                {guide.category}
              </span>
              <span className="px-3 py-1.5 bg-gray-800/80 backdrop-blur-sm rounded-full text-xs font-semibold text-gray-200">
                ⏱️ {guide.readTime}
              </span>
            </div>
          </div>

          {/* Контент модального окна */}
          <div className="p-6 sm:p-8">
            <h2 className="text-2xl sm:text-3xl font-bold font-heading text-white mb-4">
              {guide.title}
            </h2>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-cyan-300 mb-2">Описание гайда</h3>
              <p className="text-gray-300 leading-relaxed">
                {guide.description}
              </p>
            </div>

            {/* Детали гайда */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-800/50 p-4 rounded-xl">
                <div className="text-gray-400 text-sm mb-1">Категория</div>
                <div className="text-lg font-semibold text-blue-300">{guide.category}</div>
              </div>
              <div className="bg-gray-800/50 p-4 rounded-xl">
                <div className="text-gray-400 text-sm mb-1">Сложность</div>
                <div className="text-lg font-semibold text-green-300">{guide.difficulty}</div>
              </div>
              <div className="bg-gray-800/50 p-4 rounded-xl">
                <div className="text-gray-400 text-sm mb-1">Время чтения</div>
                <div className="text-lg font-semibold text-yellow-300">{guide.readTime}</div>
              </div>
            </div>

            {/* Дополнительная информация */}
            <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4">
              <h4 className="text-lg font-semibold text-cyan-300 mb-2">💡 Что вы узнаете из этого гайда?</h4>
              <ul className="text-gray-300 space-y-2">
                <li className="flex items-start">
                  <span className="text-cyan-400 mr-2">✓</span>
                  <span>Практические советы по теме "{guide.category}"</span>
                </li>
                <li className="flex items-start">
                  <span className="text-cyan-400 mr-2">✓</span>
                  <span>Пошаговые инструкции для игроков уровня "{guide.difficulty}"</span>
                </li>
                <li className="flex items-start">
                  <span className="text-cyan-400 mr-2">✓</span>
                  <span>Проверенные стратегии от опытных игроков</span>
                </li>
              </ul>
            </div>

            {/* Кнопки действий */}
            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/30 flex-1 text-center"
              >
                Начать изучение →
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg font-medium transition-colors duration-300 flex-1 text-center"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default GuideModal;