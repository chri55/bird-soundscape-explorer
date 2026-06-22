import type { Handler, HandlerEvent } from '@netlify/functions';

export const handler: Handler = async (event: HandlerEvent) => {
  const params = new URLSearchParams(
    Object.entries(event.queryStringParameters ?? {}) as [string, string][],
  );
  params.set('key', process.env.XC_API_KEY!);
  try {
    const res = await fetch(`https://xeno-canto.org/api/3/recordings?${params}`);
    return {
      statusCode: res.status,
      body: await res.text(),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch {
    return { statusCode: 502, body: 'upstream error' };
  }
};
