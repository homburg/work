// Just Paws worker: serves the static game (assets) and runs one shared multiplayer room.
// Players connect a WebSocket to /mp. The Room Durable Object relays each player's state to
// everyone else; it keeps nothing beyond the open sockets (hibernation API, so idle rooms cost nothing).
import { DurableObject } from 'cloudflare:workers';

const MAX_PLAYERS = 24;
const MAX_MSG = 400;

export class Room extends DurableObject {
  async fetch(request) {
    if (this.ctx.getWebSockets().length >= MAX_PLAYERS) return new Response('room full', { status: 503 });
    const [client, server] = Object.values(new WebSocketPair());
    const id = crypto.randomUUID().slice(0, 8);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id, n: '', c: 0, s: null });
    const others = this.ctx.getWebSockets().filter((w) => w !== server).map((w) => w.deserializeAttachment()).filter((a) => a && a.s);
    server.send(JSON.stringify({ t: 'hi', id, others }));
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > MAX_MSG) return;
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    const a = ws.deserializeAttachment() || {};
    let out = null;
    if (m.t === 'me') {
      // name + colour index, sent once after connecting
      a.n = String(m.n || '').slice(0, 16);
      a.c = Math.abs(m.c | 0) % 64;
      out = { t: 'me', id: a.id, n: a.n, c: a.c };
    } else if (m.t === 's' && Array.isArray(m.s) && m.s.length <= 12 && m.s.every((v) => typeof v === 'number' || typeof v === 'string')) {
      a.s = m.s;
      out = { t: 's', id: a.id, n: a.n, c: a.c, s: m.s };
    } else return;
    ws.serializeAttachment(a);
    const msg = JSON.stringify(out);
    for (const w of this.ctx.getWebSockets()) if (w !== ws) try { w.send(msg); } catch {}
  }

  webSocketClose(ws) { this.bye(ws); }
  webSocketError(ws) { this.bye(ws); }
  bye(ws) {
    const a = ws.deserializeAttachment();
    try { ws.close(); } catch {}
    if (!a) return;
    const msg = JSON.stringify({ t: 'bye', id: a.id });
    for (const w of this.ctx.getWebSockets()) if (w !== ws) try { w.send(msg); } catch {}
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/mp') {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
      return env.ROOM.get(env.ROOM.idFromName('default')).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
