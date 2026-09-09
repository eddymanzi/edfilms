import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function AdminRoute({ children }) {
  const { admin, checkAuth } = useAuth();
  const [checking, setChecking] = useState(!admin);

  useEffect(() => {
    if (!admin) {
      checkAuth().then(setChecking.bind(null, false));
    }
  }, [admin, checkAuth]);

  if (checking) {
    return (
      <div className="page-loading">
        <div className="spinner"></div>
        <p>Checking authorization...</p>
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

export default AdminRoute;