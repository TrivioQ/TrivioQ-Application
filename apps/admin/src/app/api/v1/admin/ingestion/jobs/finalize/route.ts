import { createProxyHandler } from '@/lib/api-proxy';

const API_BASE = process.env.API_URL || 'http://localhost:3013';
const proxy = createProxyHandler(API_BASE, '/v1/admin/ingestion/jobs/finalize', 'ingestion-finalize');

export const POST = proxy;
