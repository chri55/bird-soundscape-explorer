import type { Handler, HandlerEvent } from '@netlify/functions';

export const handler: Handler = async (event: HandlerEvent) => {
  const path = event.path.replace('/api/ebird', '');
  const params = new URLSearchParams(
    Object.entries(event.queryStringParameters ?? {}) as [string, string][],
  );
  try {
    const res = await fetch(`https://api.ebird.org/v2${path}?${params}`, {
      headers: { 'x-ebirdapitoken': process.env.EBIRD_API_KEY! },
    });
    return {
      statusCode: res.status,
      body: await res.text(),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch {
    return { statusCode: 502, body: 'upstream error' };
  }
};
