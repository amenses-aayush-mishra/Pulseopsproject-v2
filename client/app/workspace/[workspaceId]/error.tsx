'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Workspace error:', error);
  }, [error]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '20px',
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
          border: '1px solid #f1f5f9',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            margin: '0 auto 20px',
            background: 'linear-gradient(135deg, #F59E0B, #EF4444)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h1 style={{ margin: '0 0 10px', fontSize: '22px', color: '#1e293b' }}>
          Workspace Error
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: '15px', color: '#64748b', lineHeight: 1.6 }}>
          An error occurred while loading this workspace. The issue has been logged.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={reset}
            style={{
              background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 20px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              flex: 1,
              minWidth: '140px',
            }}
          >
            Retry
          </button>
          <Link
            href="/select-workspace"
            style={{
              background: 'white',
              color: '#4F46E5',
              border: '1px solid #4F46E5',
              borderRadius: '8px',
              padding: '12px 20px',
              fontSize: '15px',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              minWidth: '140px',
            }}
          >
            Switch Workspace
          </Link>
        </div>
        <details
          style={{
            marginTop: '20px',
            textAlign: 'left',
            fontSize: '11px',
            color: '#94a3b8',
          }}
        >
          <summary style={{ cursor: 'pointer', color: '#64748b' }}>
            Error Details (for debugging)
          </summary>
          <pre
            style={{
              marginTop: '10px',
              padding: '10px',
              background: '#f1f5f9',
              borderRadius: '6px',
              overflow: 'auto',
              maxHeight: '180px',
            }}
          >
            {error.message}
            {error.digest && `\nDigest: ${error.digest}`}
          </pre>
        </details>
      </div>
    </div>
  );
}