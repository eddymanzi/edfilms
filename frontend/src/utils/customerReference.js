const STORAGE_KEY = 'edfilms_customer_reference';

function generateReference() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `edfilms_${hex}`;
}

function getCustomerReference() {
  try {
    let ref = localStorage.getItem(STORAGE_KEY);
    if (!ref || !/^edfilms_[a-f0-9]{32}$/.test(ref)) {
      ref = generateReference();
      localStorage.setItem(STORAGE_KEY, ref);
    }
    return ref;
  } catch {
    return generateReference();
  }
}

export { getCustomerReference, STORAGE_KEY };