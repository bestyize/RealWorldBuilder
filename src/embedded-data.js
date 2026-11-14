export function takeEmbeddedData(selector) {
  const element = document.querySelector(selector);
  const data = element.textContent.trim();
  element.remove();
  return data;
}

export function takeEmbeddedModel() {
  const base64 = takeEmbeddedData('#model-data');
  if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(base64).buffer;
  const decoded = atob(base64);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i += 1) bytes[i] = decoded.charCodeAt(i);
  return bytes.buffer;
}
