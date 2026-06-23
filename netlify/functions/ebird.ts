import type { Handler, HandlerEvent } from '@netlify/functions';

export const handler: Handler = async (event: HandlerEvent) => {
  const path = event.path.slice('/api/ebird'.length);
  const params = new URLSearchParams(
    Object.entries(event.queryStringParameters ?? {}) as [string, string][],
  );
  try {
    const res = await fetch(`https://api.ebird.org/v2${path}?${params}`, {
      headers: { 'x-ebirdapitoken': process.env.EBIRD_API_KEY! },
    });
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (path.startsWith('/ref/hotspot/')) {
      headers['Cache-Control'] = 'public, s-maxage=604800';
    }
    return {
      statusCode: res.status,
      body: await res.text(),
      headers,
    };
  } catch {
    return { statusCode: 502, body: 'upstream error' };
  }
};
