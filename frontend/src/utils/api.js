const API_URL = import.meta.env.VITE_API_URL || '';

async function apiFetch(path, options = {}) {
  const config = {
    ...options,
    headers: {
      ...(options.headers || {}),
    },
    credentials: 'include'
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
    config.headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_URL}${path}`, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errObj = data?.error;
    const message = typeof errObj === 'string' ? errObj : (errObj?.message || `Request failed with status ${response.status}`);
    const error = new Error(message);
    error.status = response.status;
    error.code = typeof errObj === 'object' && errObj && errObj.code ? errObj.code : undefined;
    error.data = data;
    throw error;
  }

  return data;
}

export { API_URL, apiFetch };