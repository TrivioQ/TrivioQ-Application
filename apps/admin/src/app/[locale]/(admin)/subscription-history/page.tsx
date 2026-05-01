import { Suspense } from 'react';
import { SubscriptionHistoryExplorer } from '@/components/subscription-history/subscription-history-explorer';

export default function SubscriptionHistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Subscription History</h1>
        <p className="text-gray-500 mt-2">
          Search for a user to view their full subscription tier change history.
        </p>
      </div>
      <Suspense>
        <SubscriptionHistoryExplorer />
      </Suspense>
    </div>
  );
}
