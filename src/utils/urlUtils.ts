export function getTopLevelEventPath(url: string): string {
  url = url.replace(/\/$/, '');
  if (url.startsWith('/e/')) {
    const parts = url.split('/');
    return `/${parts[1]}/${parts[2]}`;
  }
  const parts = url.split('/');
  return `/${parts[1]}`;
} 