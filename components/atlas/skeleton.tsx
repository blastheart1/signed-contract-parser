'use client';

import React from 'react';

const shimmerStyle: React.CSSProperties = {
  background: '#E8EAF0',
  borderRadius: 4,
  animation: 'atlas-shimmer 1.2s ease-in-out infinite alternate',
};

const shimmerKeyframes = `
@keyframes atlas-shimmer {
  from { opacity: 0.5; }
  to   { opacity: 1; }
}
`;

export function SkeletonLine({
  width = '100%',
  height = 12,
}: {
  width?: string | number;
  height?: number;
}) {
  return (
    <>
      <style>{shimmerKeyframes}</style>
      <div
        style={{
          ...shimmerStyle,
          width,
          height,
          display: 'inline-block',
        }}
      />
    </>
  );
}

export function SkeletonRow() {
  return (
    <tr>
      {[70, 120, 80, 90, 60].map((w, i) => (
        <td key={i} style={{ padding: '12px 14px' }}>
          <SkeletonLine width={w} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonCard() {
  return (
    <div
      style={{
        padding: '16px 18px',
        background: '#F5F6FA',
        borderRadius: 8,
        border: '1px solid #E8EAF0',
      }}
    >
      <SkeletonLine width={80} height={10} />
      <div style={{ marginTop: 8 }}>
        <SkeletonLine width={48} height={24} />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <>
      <style>{shimmerKeyframes}</style>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F5F6FA' }}>
              {[120, 100, 80, 90, 70].map((w, i) => (
                <th key={i} style={{ padding: '10px 14px', textAlign: 'left' }}>
                  <SkeletonLine width={w} height={10} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
