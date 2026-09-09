import React from 'react';

function Loader() {
  return (
    <div className="spinner-wrap">
      <div className="spinner"></div>
      <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Loading...</p>
    </div>
  );
}

export default Loader;
