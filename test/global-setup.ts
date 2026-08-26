/**
 * Jest globalSetup — runs once before any test file is loaded.
 * order-bff has no datastore; its dependencies are order-service and
 * payment-service, stood up here as minimal in-process HTTP stubs.
 *
 * The payment stub exposes a debug toggle (PUT /debug/down) so the e2e suite
 * can flip it "down" mid-run and prove the partial-failure tolerance for
 * real, over the network — not just by mocking fetch.
 */
import { createServer, type Server } from 'node:http';

function startOrderStub(): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const match = /^\/orders\/([^/]+)$/.exec(req.url ?? '');
      if (req.method === 'GET' && match) {
        const id = decodeURIComponent(match[1]);
        if (id === 'missing-order') {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'not found' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            id,
            userEmail: 'alice@example.com',
            items: [{ sku: 'sku-1', qty: 1, price: 500 }],
            total: 500,
            status: 'CONFIRMED',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        );
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'not found' }));
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function startPaymentStub(): Promise<Server> {
  let down = false;
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      if (req.method === 'PUT' && req.url === '/debug/down') {
        down = true;
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.method === 'PUT' && req.url === '/debug/up') {
        down = false;
        res.writeHead(204);
        res.end();
        return;
      }
      if (down) {
        // Simulate an outage by destroying the connection — no HTTP response at all.
        req.socket.destroy();
        return;
      }
      if (req.method === 'GET' && req.url?.startsWith('/payments')) {
        const url = new URL(req.url, 'http://localhost');
        const orderId = url.searchParams.get('orderId');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            data: [{ id: 'pay-1', orderId, userId: 'alice@example.com', amount: 500, status: 'SUCCEEDED', createdAt: '', updatedAt: '' }],
            total: 1,
            page: 1,
            limit: 1,
          }),
        );
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'not found' }));
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function port(server: Server): number {
  const addr = server.address();
  if (typeof addr !== 'object' || addr === null) throw new Error('stub server failed to bind a TCP port');
  return addr.port;
}

export default async function globalSetup(): Promise<void> {
  const [orders, payments] = await Promise.all([startOrderStub(), startPaymentStub()]);

  process.env.PORT = '3013';
  process.env.AUTH_DISABLED = 'true';
  process.env.ORDER_SERVICE_URL = `http://127.0.0.1:${port(orders)}`;
  process.env.PAYMENT_SERVICE_URL = `http://127.0.0.1:${port(payments)}`;

  (global as { __ORDER_STUB__?: Server }).__ORDER_STUB__ = orders;
  (global as { __PAYMENT_STUB__?: Server }).__PAYMENT_STUB__ = payments;
}
