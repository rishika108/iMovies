import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function StatsCard({ title, value, icon, color = 'var(--primary-red)' }) {
  const isFontAwesome = icon && typeof icon === 'object' && icon.iconName;

  return (
    <div
      className="card h-100 border-0 shadow-sm"
      style={{
        backgroundColor: 'var(--dark-card)',
        borderRadius: '12px',
        border: '1px solid #262626',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
      }}
    >
      <div className="card-body p-4 d-flex align-items-center justify-content-between">
        <div>
          <span
            className="text-secondary text-uppercase fw-semibold"
            style={{ fontSize: '0.75rem', letterSpacing: '0.08em' }}
          >
            {title}
          </span>
          <h3 className="text-white fw-bold mt-2 mb-0" style={{ fontSize: '1.85rem' }}>
            {value !== undefined && value !== null ? value : 0}
          </h3>
        </div>
        <div
          className="d-flex align-items-center justify-content-center rounded-3"
          style={{
            width: '56px',
            height: '56px',
            backgroundColor: `${color}1a`, // 10% opacity hex
            color: color,
            fontSize: '1.5rem',
            border: `1px solid ${color}40`
          }}
        >
          {isFontAwesome ? (
            <FontAwesomeIcon icon={icon} />
          ) : (
            icon
          )}
        </div>
      </div>
    </div>
  );
}
