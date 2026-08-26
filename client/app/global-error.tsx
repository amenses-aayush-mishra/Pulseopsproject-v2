'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '20px',
            fontFamily: 'system-ui, sans-serif',
            backgroundColor: '#f8fafc',
          }}
        >
          <div
            style={{
              maxWidth: '500px',
              width: '100%',
              background: 'white',
              borderRadius: '12px',
              padding: '32px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                margin: '0 auto 24px',
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h1 style={{ margin: '0 0 12px', fontSize: '24px', color: '#1e293b' }}>
              Something went wrong
            </h1>
            <p style={{ margin: '0 0 24px', fontSize: '16px', color: '#64748b', lineHeight: 1.5 }}>
              A critical error occurred in the application. This is usually temporary.
            </p>
            <button
              onClick={reset}
              style={{
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'transform 0.1s, box-shadow 0.1s',
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              Try Again
            </button>
            <details
              style={{
                marginTop: '24px',
                textAlign: 'left',
                fontSize: '12px',
                color: '#94a3b8',
              }}
            >
              <summary style={{ cursor: 'pointer', color: '#64748b' }}>
                Error Details (for debugging)
              </summary>
              <pre
                style={{
                  marginTop: '12px',
                  padding: '12px',
                  background: '#f1f5f9',
                  borderRadius: '6px',
                  overflow: 'auto',
                  maxHeight: '200px',
                }}
              >
                {error.message}
                {error.digest && `\nDigest: ${error.digest}`}
              </pre>
            </details>
          </div>
        </div>
      </body>
    </html>
  );
}