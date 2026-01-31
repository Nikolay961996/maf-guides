import { useEffect } from 'react';
import { sendAnalyticsData } from '../services/analytics';

/**
 * Хук для отправки аналитики при загрузке страницы
 * @param linkId - ID ссылки из URL
 */
export const useAnalytics = (linkId: string | number) => {
  useEffect(() => {
    // Отправляем аналитику только при первом рендере
    sendAnalyticsData(linkId);
  }, [linkId]);
};