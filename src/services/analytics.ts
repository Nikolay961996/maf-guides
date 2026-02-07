import axios from 'axios';

// Конфигурация
const IPINFO_TOKEN = import.meta.env.VITE_IPINFO_TOKEN;
const IP_API_ENDPOINT = IPINFO_TOKEN
  ? `https://ipinfo.io/json?token=${IPINFO_TOKEN}`
  : 'https://ipinfo.io/json'; // Без токена будет ограничение (1000 запросов/день)

// Яндекс Метрика
declare global {
  interface Window {
    ym: (counterId: number, event: string, ...args: any[]) => void;
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

/**
 * Отправка события в Яндекс Метрику
 */
export const sendToYandexMetrika = (event: string, params?: Record<string, any>) => {
  if (typeof window === 'undefined' || !window.ym) return;
  try {
    window.ym(106551842, event, params);
    if (event === 'analytics_data_collected')
      window.ym(106551842,'reachGoal', event, params)
  } catch (error) {
    console.error('Failed to send event to Yandex Metrika:', error);
  }
};

/**
 * Отправка события в Google Analytics
 */
export const sendToGoogleAnalytics = (event: string, params?: Record<string, any>) => {
  if (typeof window === 'undefined' || !window.gtag) return;
  try {
    window.gtag('event', event, params);
  } catch (error) {
    console.error('Failed to send event to Google Analytics:', error);
  }
};

/**
 * Отправка события о сборе аналитики
 */
export const sendAnalyticsEvent = (analyticsData: any) => {
  // Отправляем обезличенные данные
  const safeData = {
    linkId: analyticsData.linkId,
    country: analyticsData.country,
    screenResolution: analyticsData.screenResolution,
    language: analyticsData.language,
    referrer: analyticsData.referrer ? 'has_referrer' : 'direct',
  };

  // Отправка в Яндекс Метрику
  sendToYandexMetrika('analytics_data_collected', safeData);

  // Отправка в Google Analytics
  sendToGoogleAnalytics('analytics_data_collected', safeData);

  console.log('Analytics event sent to Yandex Metrika and Google Analytics:', safeData);
};

/**
 * Отправка события фильтрации по категории
 */
export const sendFilterEvent = (category: string) => {
  const eventData = { category };
  sendToYandexMetrika('filter_category', eventData);
  sendToGoogleAnalytics('filter_category', eventData);
  console.log('Filter event sent:', eventData);
};

/**
 * Отправка события поиска
 */
export const sendSearchEvent = (query: string, resultsCount: number) => {
  const eventData = { query, resultsCount };
  sendToYandexMetrika('search_query', eventData);
  sendToGoogleAnalytics('search_query', eventData);
  console.log('Search event sent:', eventData);
};

/**
 * Отправка события просмотра карточки
 */
export const sendCardViewEvent = (cardId: number, title: string, category: string) => {
  const eventData = { cardId, title, category };
  sendToYandexMetrika('view_card', eventData);
  sendToGoogleAnalytics('view_card', eventData);
  console.log('Card view event sent:', eventData);
};

/**
 * Отправка события клика по карточке
 */
export const sendCardClickEvent = (cardId: number, title: string, category: string) => {
  const eventData = { cardId, title, category };
  sendToYandexMetrika('click_card', eventData);
  sendToGoogleAnalytics('click_card', eventData);
  console.log('Card click event sent:', eventData);
};

// Интерфейс данных аналитики
export interface AnalyticsData {
  linkId: string | number;
  timestamp: string;
  userAgent: string;
  ipAddress: string;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  referrer: string;
  screenResolution: string;
  language: string;
}

// Получение информации о местоположении по IP
export const getLocationInfo = async (): Promise<{
  ip: string;
  country: string;
  countryCode: string;
  region: string;
  city: string;
}> => {
  try {
    const response = await axios.get(IP_API_ENDPOINT);
    // ipinfo.io возвращает: ip, city, region, country (код), loc, org, postal, timezone
    return {
      ip: response.data.ip || 'unknown',
      country: response.data.country || 'unknown', // Код страны (US, RU и т.д.)
      countryCode: response.data.country || 'unknown',
      region: response.data.region || 'unknown',
      city: response.data.city || 'unknown',
    };
  } catch (error) {
    console.error('Failed to fetch location info:', error);
    // Возвращаем значения по умолчанию в случае ошибки
    return {
      ip: 'unknown',
      country: 'unknown',
      countryCode: 'unknown',
      region: 'unknown',
      city: 'unknown',
    };
  }
};

// Сбор данных аналитики
export const collectAnalyticsData = async (linkId: string | number): Promise<AnalyticsData> => {
  const locationInfo = await getLocationInfo();

  const analyticsData: AnalyticsData = {
    linkId,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    ipAddress: locationInfo.ip,
    country: locationInfo.country,
    countryCode: locationInfo.countryCode,
    region: locationInfo.region,
    city: locationInfo.city,
    referrer: document.referrer,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    language: navigator.language,
  };

  return analyticsData;
};

// Отправка данных аналитики на сервер
export const sendAnalyticsData = async (linkId: string | number): Promise<void> => {
  try {
    const analyticsData = await collectAnalyticsData(linkId);

    // В реальном приложении здесь будет отправка на ваш бэкенд
    console.log('Analytics data collected:', analyticsData);

    // Пример отправки на бэкенд (раскомментировать когда будет настроен бэкенд)
    // await axios.post(ANALYTICS_ENDPOINT, analyticsData);

    // Для демонстрации сохраняем в localStorage
    const existingAnalytics = JSON.parse(localStorage.getItem('analytics_log') || '[]');
    existingAnalytics.push(analyticsData);
    localStorage.setItem('analytics_log', JSON.stringify(existingAnalytics));

    // Отправляем событие в Яндекс Метрику и Google Analytics
    sendAnalyticsEvent(analyticsData);

  } catch (error) {
    console.error('Failed to send analytics data:', error);
  }
};

// Получение статистики из localStorage (для демонстрации)
export const getAnalyticsStats = () => {
  try {
    const analyticsLog = JSON.parse(localStorage.getItem('analytics_log') || '[]');
    return analyticsLog;
  } catch (error) {
    console.error('Failed to get analytics stats:', error);
    return [];
  }
};