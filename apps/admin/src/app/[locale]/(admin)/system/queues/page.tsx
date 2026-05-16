import { env } from 'env';

export default function QueuesPage() {
  const apiUrl = env.API_URL;


  return (
    <div className="-m-8 h-screen">
      <iframe
        src={`${apiUrl}/admin/queues`}
        className="h-full w-full border-0"
        title="Bull-Board Queue Monitor"
      />
    </div>
  );
}
