export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function handler(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const targetPath = path.join('/');
    const incomingUrl = new URL(req.url);
    const targetUrl = `${SUPABASE_URL}/${targetPath}${incomingUrl.search}`;

    const headers: Record<string, string> = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
    };

    const accept = req.headers.get('Accept');
    if (accept) headers['Accept'] = accept;

    const prefer = req.headers.get('Prefer');
    if (prefer) headers['Prefer'] = prefer;
    const contentRange = req.headers.get('Content-Range');
    if (contentRange) headers['Content-Range'] = contentRange;
    const range = req.headers.get('Range');
    if (range) headers['Range'] = range;

    const body = req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined;

    const upstream = await fetch(targetUrl, {
        method: req.method,
        headers,
        body,
    });

    const responseHeaders: Record<string, string> = {
        'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
    };
    const contentRangeOut = upstream.headers.get('Content-Range');
    if (contentRangeOut) responseHeaders['Content-Range'] = contentRangeOut;

    const responseBody = await upstream.text();
    
    if (!upstream.ok) {
        console.error(`[Supabase Proxy] Error ${upstream.status} from ${targetUrl}:`, responseBody);
    }

    return new Response(responseBody, {
        status: upstream.status,
        headers: responseHeaders,
    });
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
