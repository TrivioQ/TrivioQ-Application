import { getTranslations } from 'next-intl/server';
import { HistoryView } from './history-view';

export async function generateMetadata() {
  const t = await getTranslations('metadata');
  return {
    title: t('historyTitle'),
    description: t('historyDescription'),
  };
}

export default function HistoryPage() {
  return <HistoryView />;
}
