import { apiFetch, API_URL } from './api';
import { getCustomerReference } from './customerReference';

async function getMediaAccessUrl(movie, purpose, customerReferenceOverride) {
  const id = typeof movie === 'object' ? movie.id : movie;
  const customerReference = customerReferenceOverride || getCustomerReference();
  const res = await apiFetch(`/api/movies/${id}/access-token`, {
    method: 'POST',
    body: { customerReference, purpose }
  });
  const token = res?.data?.token;
  if (!token) throw new Error('No media access token returned');
  const resource = purpose === 'watch' ? 'stream' : 'download';
  return `${API_URL}/api/movies/${id}/${resource}?token=${encodeURIComponent(token)}`;
}

export { getMediaAccessUrl };