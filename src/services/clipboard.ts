export async function copyText(value: string): Promise<boolean> {
  try { if (window.isSecureContext && navigator.clipboard) { await navigator.clipboard.writeText(value); return true; } } catch {}
  const field = document.createElement('textarea'); field.value = value;
  field.style.position = 'fixed'; field.style.opacity = '0'; document.body.appendChild(field);
  field.focus(); field.select(); let ok = false;
  try { ok = document.execCommand('copy'); } catch {} finally { field.remove(); }
  if (!ok) window.prompt('Salin manual dengan Ctrl+C atau tekan lama:', value);
  return ok;
}
