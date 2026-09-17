export function getCleanErrorMessage(err: any, fallback = 'Request is not acceptable'): string {
  const details = err?.response?.data?.error?.details;
  if (Array.isArray(details) && details.length > 0 && details[0]?.message) {
    return details[0].message;
  }

  const rawMsg = err?.response?.data?.error?.message || err?.message || fallback;

  if (typeof rawMsg !== 'string') {
    return fallback;
  }

  const lower = rawMsg.toLowerCase();

  // If database connection error
  if (
    err?.response?.status === 503 ||
    lower.includes('database') ||
    lower.includes('connection') ||
    lower.includes('p1017') ||
    lower.includes('p1001') ||
    lower.includes('closed the connection') ||
    lower.includes('connectionreset')
  ) {
    return 'Cannot connect to database. Please try again in a moment.';
  }

  // If raw backend trace or Prisma error
  if (
    rawMsg.includes('Prisma') ||
    rawMsg.includes('invocation') ||
    rawMsg.includes('code:') ||
    rawMsg.includes('at ') ||
    rawMsg.includes('line ') ||
    rawMsg.includes('C:\\') ||
    rawMsg.includes('/server/') ||
    rawMsg.length > 120
  ) {
    return fallback;
  }

  return rawMsg;
}
