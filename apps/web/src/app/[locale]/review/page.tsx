import { getTranslations } from 'next-intl/server';
import { ReviewView } from './review-view';

export async function generateMetadata() {
  const t = await getTranslations('metadata');
  return {
    title: t('reviewTitle'),
    description: t('reviewDescription'),
  };
}

export default function ReviewPage() {
  return <ReviewView />;
}
