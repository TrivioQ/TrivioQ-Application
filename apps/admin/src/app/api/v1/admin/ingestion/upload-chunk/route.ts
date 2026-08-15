import { createProxyHandler } from '@/lib/api-proxy';

const API_BASE = process.env.API_URL || 'http://localhost:3013';
const proxy = createProxyHandler(API_BASE, '/v1/admin/ingestion/upload-chunk', 'ingestion-upload-chunk');

export const POST = proxy;
