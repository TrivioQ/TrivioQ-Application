import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// Lines arrive pre-localized from the client; clamp them so the endpoint can't be
// used to render arbitrary long text.
const clamp = (v: string | null, max = 80) => (v ?? '').slice(0, max);

/**
 * GET /api/share-card?category=…&emoji=…&l1=…&l2=…&l3=…&cta=…
 * Renders a 1080×1080 PNG result card for sharing (Web Share API / download).
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const emoji = q.get('emoji') === 'brain' ? '🧠' : '🎯';

  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 90, background: 'linear-gradient(135deg, #0F172A 0%, #134E4A 100%)', color: '#FFFFFF', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', fontSize: 84, fontWeight: 900 }}>
          Trivio<span style={{ color: '#2DD4BF' }}>Q</span>
        </div>
        <div style={{ fontSize: 40, color: '#94A3B8', marginTop: 8 }}>{clamp(q.get('category'), 40)}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 150 }}>{emoji}</div>
        <div style={{ fontSize: 72, fontWeight: 800, marginTop: 20 }}>{clamp(q.get('l1'))}</div>
        <div style={{ fontSize: 46, color: '#CBD5E1', marginTop: 14 }}>{clamp(q.get('l2'))}</div>
        {q.get('l3') ? <div style={{ fontSize: 46, color: '#34D399', marginTop: 10, fontWeight: 700 }}>{clamp(q.get('l3'))}</div> : null}
      </div>
      <div style={{ display: 'flex', fontSize: 36, color: '#94A3B8', borderTop: '2px solid #1E293B', paddingTop: 30 }}>{clamp(q.get('cta'), 100)}</div>
    </div>,
    { width: 1080, height: 1080 },
  );
}
