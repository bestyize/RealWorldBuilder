export async function readModel(id = 'model-data') {
  const element = document.getElementById(id);
  const url = element.dataset.url;
  if (url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Unable to load ${url} (${response.status})`);
    return response.arrayBuffer();
  }

  const base64 = element.textContent.trim();
  if (typeof Uint8Array.fromBase64 === 'function') return Uint8Array.fromBase64(base64).buffer;
  const decoded = atob(base64);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i += 1) bytes[i] = decoded.charCodeAt(i);
  return bytes.buffer;
}
