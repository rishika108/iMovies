import React from 'react';

export default function SeatLegend() {
  const legendItems = [
    { label: 'Available', color: 'var(--seat-available, #2ecc71)', border: '#2ecc71' },
    { label: 'Selected', color: 'var(--seat-selected, #0096ff)', border: '#0096ff' },
    { label: 'Locked', color: 'var(--seat-locked, #f39c12)', border: '#f39c12' },
    { label: 'Booked', color: 'var(--seat-booked, #e74c3c)', border: '#e74c3c' }
  ];

  return (
    <div className="d-flex flex-wrap align-items-center justify-content-center gap-4 py-3 px-4 rounded-3" style={{ background: '#141414', border: '1px solid #262626' }}>
      {legendItems.map((item) => (
        <div key={item.label} className="d-flex align-items-center gap-2">
          <span
            style={{
              width: '18px',
              height: '18px',
              backgroundColor: item.color,
              border: `1px solid ${item.border}`,
              borderRadius: '4px 4px 1px 1px',
              display: 'inline-block'
            }}
          />
          <span className="text-secondary small fw-medium">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
