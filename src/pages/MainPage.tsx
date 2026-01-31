import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAnalytics } from '../hooks/useAnalytics';
import GuideCard from '../components/GuideCard';
import AnimatedBackground from '../components/AnimatedBackground';
import { sendFilterEvent, sendSearchEvent } from '../services/analytics';

// Типы для гайдов
export interface Guide {
  id: number;
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  difficulty: 'Легко' | 'Средне' | 'Сложно';
  readTime: string;
}

// Тестовые данные гайдов
const mockGuides: Guide[] = [
  {
    id: 1,
    title: 'Основы выживания в Tiles Survive!',
    description: 'Узнайте, как пережить первые дни в игре, собирать ресурсы и строить убежище. Этот гайд поможет новичкам освоиться в мире Tiles Survive!',
    imageUrl: '/images/guide1.svg',
    category: 'Выживание',
    difficulty: 'Легко',
    readTime: '5 мин',
  },
  {
    id: 2,
    title: 'Секретные локации и артефакты',
    description: 'Откройте для себя скрытые локации, которые содержат мощные артефакты и редкие ресурсы. Полное руководство по исследованию карты.',
    imageUrl: '/images/guide2.svg',
    category: 'Исследование',
    difficulty: 'Средне',
    readTime: '12 мин',
  },
  {
    id: 3,
    title: 'Боевая система и PvP тактики',
    description: 'Мастер-класс по боевой системе: эффективные комбо, уклонения и тактики для победы в PvP-столкновениях.',
    imageUrl: '/images/guide3.svg',
    category: 'Бой',
    difficulty: 'Сложно',
    readTime: '18 мин',
  },
  {
    id: 4,
    title: 'Крафтинг и улучшение предметов',
    description: 'Полный рецептурный справочник по крафтингу. Узнайте, как создавать лучшие инструменты, оружие и броню.',
    imageUrl: '/images/guide4.svg',
    category: 'Крафтинг',
    difficulty: 'Средне',
    readTime: '10 мин',
  },
  {
    id: 5,
    title: 'Экономика и торговля с NPC',
    description: 'Как заработать максимальное количество внутриигровой валюты. Стратегии торговли и выгодные сделки с NPC.',
    imageUrl: '/images/guide5.svg',
    category: 'Экономика',
    difficulty: 'Легко',
    readTime: '8 мин',
  },
  {
    id: 6,
    title: 'Секретные достижения и трофеи',
    description: 'Руководство по получению всех скрытых достижений и трофеев. Повысьте свой игровой статус до максимального уровня.',
    imageUrl: '/images/guide6.svg',
    category: 'Достижения',
    difficulty: 'Сложно',
    readTime: '15 мин',
  },
];

const MainPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [selectedCategory, setSelectedCategory] = useState<string>('Все');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Используем хук аналитики для отправки данных
  useAnalytics(id || 'unknown');

  // Очистка таймера при размонтировании
  React.useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  // Обработчик изменения поискового запроса
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);

    // Очищаем предыдущий таймер
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    // Устанавливаем новый таймер для отправки события через 500 мс
    searchTimerRef.current = setTimeout(() => {
      if (value.trim() !== '') {
        sendSearchEvent(value, 0);
      }
    }, 500);
  };

  // Обработчик изменения категории
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    sendFilterEvent(category);
  };

  // Категории для фильтрации
  const categories = ['Все', 'Выживание', 'Исследование', 'Бой', 'Крафтинг', 'Экономика', 'Достижения'];

  // Фильтрация гайдов
  const filteredGuides = mockGuides.filter(guide => {
    const matchesCategory = selectedCategory === 'Все' || guide.category === selectedCategory;
    const matchesSearch = guide.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         guide.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white relative overflow-hidden">
      <AnimatedBackground />
      {/* Хедер */}
      <header className="sticky top-0 z-50 border-b border-gray-700 relative overflow-hidden">
        {/* Фоновое изображение из игры */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(/images/header-bg.svg)',
            backgroundPosition: 'center 30%'
          }}
        ></div>
        {/* Затемнение и размытие */}
        <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm"></div>

        <div className="container mx-auto px-4 sm:px-6 md:px-10 lg:px-16 py-6 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-center md:text-left">
              <h1 className="text-3xl md:text-4xl font-bold font-heading bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
                Tiles Survive! Guides
              </h1>
              <p className="text-gray-300 mt-2">Лучшие гайды и советы по игре от сообщества</p>
              {id && (
                <div className="mt-2 inline-block px-3 py-1 bg-gray-800 rounded-full text-sm">
                  <span className="text-gray-300">ID ссылки: </span>
                  <span className="font-mono text-cyan-300">{id}</span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Поиск гайдов..."
                  className="bg-gray-800 border border-gray-700 rounded-full py-2 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Фильтры */}
      <div className="container mx-auto px-4 sm:px-6 md:px-10 lg:px-16 py-6">
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map(category => (
            <button
              key={category}
              className={`px-4 py-2 rounded-full transition-all duration-300 ${selectedCategory === category
                ? 'bg-gradient-to-r from-cyan-600 to-purple-600 text-white shadow-lg'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
              onClick={() => handleCategoryChange(category)}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Статистика */}
        <div className="mb-8 p-6 bg-gradient-to-r from-gray-800/50 to-gray-900/50 rounded-2xl border border-gray-700">
          <h2 className="text-2xl font-bold font-heading mb-4">📊 Статистика посещений</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800/50 p-4 rounded-xl">
              <div className="text-gray-300 text-sm">ID ссылки</div>
              <div className="text-2xl font-bold text-cyan-300">{id || 'Не указан'}</div>
            </div>
            <div className="bg-gray-800/50 p-4 rounded-xl">
              <div className="text-gray-300 text-sm">Всего гайдов</div>
              <div className="text-2xl font-bold text-purple-300">{mockGuides.length}</div>
            </div>
            <div className="bg-gray-800/50 p-4 rounded-xl">
              <div className="text-gray-300 text-sm">Найдено гайдов</div>
              <div className="text-2xl font-bold text-green-300">{filteredGuides.length}</div>
            </div>
          </div>
          <p className="text-gray-400 text-sm mt-4">
            *Аналитика по посещениям собирается автоматически (IP, страна, время захода)
          </p>
        </div>

        {/* Сетка гайдов */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold font-heading mb-6">🎮 Гайды по Tiles Survive!</h2>
          {filteredGuides.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {filteredGuides.map((guide, index) => (
                <div
                  key={guide.id}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <GuideCard guide={guide} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-500 text-6xl mb-4">😕</div>
              <h3 className="text-xl font-semibold font-heading mb-2">Гайды не найдены</h3>
              <p className="text-gray-500">Попробуйте изменить фильтры или поисковый запрос</p>
            </div>
          )}
        </div>

        {/* Информационный блок */}
        <div className="bg-gradient-to-r from-cyan-900/20 to-purple-900/20 border border-cyan-700/30 rounded-2xl p-6 mb-8">
          <h3 className="text-xl font-bold font-heading mb-4">ℹ️ Как пользоваться сайтом</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="text-cyan-300 font-semibold">1. Выберите гайд</div>
              <p className="text-gray-400">Найдите интересующий вас гайд с помощью фильтров и поиска</p>
            </div>
            <div className="space-y-2">
              <div className="text-cyan-300 font-semibold">2. Изучите материал</div>
              <p className="text-gray-400">Читайте подробные инструкции с скриншотами и советами</p>
            </div>
            <div className="space-y-2">
              <div className="text-cyan-300 font-semibold">3. Примените в игре</div>
              <p className="text-gray-400">Используйте полученные знания для улучшения игрового опыта</p>
            </div>
          </div>
        </div>
      </div>

      {/* Футер */}
      <footer className="border-t border-gray-800 py-12 relative overflow-hidden">
        {/* Фоновое изображение газона из игры */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(/images/footer-bg.svg)',
            backgroundPosition: 'center 70%'
          }}
        ></div>
        {/* Затемнение */}
        <div className="absolute inset-0 bg-gray-900/90"></div>

        <div className="container mx-auto px-4 sm:px-6 md:px-10 lg:px-16 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <div className="text-xl font-bold text-white">Tiles Survive! Guides</div>
              <p className="text-gray-300">Неофициальный фанатский сайт с гайдами</p>
            </div>
            <div className="text-gray-300 text-sm">
              <p>Все материалы собраны сообществом. Мы не связаны с разработчиками игры.</p>
              <p className="mt-2">Аналитика собирается анонимно для статистики посещений.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MainPage;