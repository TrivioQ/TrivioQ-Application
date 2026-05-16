export default function NotFound() {
  return (
    <html>
      <body style={{ fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', margin: 0, backgroundColor: '#030712', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '3rem', margin: '0 0 10px 0' }}>404</h1>
          <p style={{ color: '#9ca3af' }}>The page you are looking for does not exist or has been moved.</p>
          <a href="/" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 'bold' }}>
            Go to Homepage →
          </a>
        </div>
      </body>
    </html>
  );
}
