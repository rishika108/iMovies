import React from 'react';

export default function Loader({ message = 'Loading...', fullScreen = true }) {
  const content = (
    <div className="d-flex flex-column align-items-center justify-content-center gap-3">
      <div className="loader-spinner" role="status" aria-label="Loading"></div>
      <p className="text-secondary fw-medium mb-0" style={{ letterSpacing: '0.5px' }}>
        {message}
      </p>
    </div>
  );

  if (!fullScreen) {
    return <div className="py-5 text-center">{content}</div>;
  }

  return (
    <div className="loader-overlay" aria-live="polite">
      {content}
    </div>
  );
}
