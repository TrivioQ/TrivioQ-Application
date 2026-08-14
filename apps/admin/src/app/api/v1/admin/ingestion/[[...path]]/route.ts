import { createProxyHandler } from '@/lib/api-proxy';

const API_BASE = process.env.API_URL || 'http://localhost:3013';
const proxy = createProxyHandler(API_BASE, '/v1/admin/ingestion', 'ingestion');

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
