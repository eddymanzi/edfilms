import React from 'react';

function EmptyState({ title = 'Nothing to show', message = 'No items found.' }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}

export default EmptyState;