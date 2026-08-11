import React from 'react';

// Renders 5 stars with support for half stars using inline SVGs.
export default function StarRating({ value, size = 16, color = '#f5c542', showNumeric = false }) {
  if (value == null) return <span style={{ color: '#888' }}>—</span>;
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const diff = value - i + 1; // e.g., value=3.5, i=4 -> diff=0.5
    let type = 'empty';
    if (diff >= 1) type = 'full';
    else if (diff === 0.5) type = 'half';
    else if (diff > 0 && diff < 1) type = 'half';
    stars.push(type);
  }

  const starSvg = (kind, key) => {
    if (kind === 'full') return (
      <svg key={key} width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ marginRight: 2 }}>
        <path d="M12 .587l3.668 7.431L24 9.748l-6 5.847L19.335 24 12 20.202 4.665 24 6 15.595 0 9.748l8.332-1.73z" />
      </svg>
    );
    if (kind === 'half') return (
      <svg key={key} width={size} height={size} viewBox="0 0 24 24" style={{ marginRight: 2 }}>
        <defs>
          <linearGradient id={`g${key}`} x1="0" x2="1">
            <stop offset="50%" stopColor={color} />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <path d="M12 .587l3.668 7.431L24 9.748l-6 5.847L19.335 24 12 20.202 4.665 24 6 15.595 0 9.748l8.332-1.73z" fill={`url(#g${key})`} stroke={color} />
      </svg>
    );
    return (
      <svg key={key} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} style={{ marginRight: 2 }}>
        <path d="M12 .587l3.668 7.431L24 9.748l-6 5.847L19.335 24 12 20.202 4.665 24 6 15.595 0 9.748l8.332-1.73z" />
      </svg>
    );
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        {stars.map((s, i) => starSvg(s, i))}
      </span>
      {showNumeric && <span style={{ color: '#ddd', fontSize: size * 0.9 }}>{value}</span>}
    </span>
  );
}
