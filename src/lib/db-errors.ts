export function isDatabaseUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const message =
    'message' in error && typeof error.message === 'string'
      ? error.message
      : '';
  const name =
    'name' in error && typeof error.name === 'string'
      ? error.name
      : '';

  return (
    name === 'PrismaClientInitializationError' ||
    message.includes("Can't reach database server") ||
    message.includes('PrismaClientInitializationError') ||
    message.includes('Connection error')
  );
}
