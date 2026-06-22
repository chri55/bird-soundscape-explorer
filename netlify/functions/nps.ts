import type { Handler, HandlerEvent } from '@netlify/functions';

export const handler: Handler = async (event: HandlerEvent) => {
  const params = new URLSearchParams(
    Object.entries(event.queryStringParameters ?? {}) as [string, string][],
  );
  params.set('api_key', process.env.NPS_API_KEY!);
  try {
    const res = await fetch(`https://developer.nps.gov/api/v1/parks?${params}`);
    return {
      statusCode: res.status,
      body: await res.text(),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch {
    return { statusCode: 502, body: 'upstream error' };
  }
};
