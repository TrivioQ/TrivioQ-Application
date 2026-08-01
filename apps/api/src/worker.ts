process.env.TZ = 'UTC';

// Import and start workers
import './workers/notification-worker';
import './workers/email-worker';
import './workers/drop-worker';
import './workers/ingestion-worker';

console.log('BullMQ workers initialized.');
