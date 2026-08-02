process.env.TZ = 'UTC';

// Import and start workers
import './workers/notification-worker';
import './workers/email-worker';
import './workers/drop-worker';
// Note: ingestion-worker is now a standalone Express HTTP server
// (dist/workers/ingestion-worker.js) run separately in the worker-ingestion container.

console.log('BullMQ workers initialized.');
