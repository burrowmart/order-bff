/**
 * order-bff e2e verification.
 * order-service and payment-service are minimal in-process HTTP stubs
 * started by test/global-setup.ts. The payment stub can be toggled "down"
 * over the network (PUT /debug/down) so the partial-failure proof exercises
 * a real dropped connection, not a mocked rejection.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';

describe('Orders (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.listen(0);
    const address = app.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await fetch(`${process.env.PAYMENT_SERVICE_URL}/debug/up`, { method: 'PUT' }); // leave it healthy for other suites
    await app.close();
  });

  const asJson = async <T>(res: Response): Promise<T> => (await res.json()) as T;

  it('GET /health — returns ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(await asJson(res)).toEqual({ status: 'ok' });
  });

  it('GET /orders/:id — aggregates order + payment status when both services are healthy', async () => {
    const res = await fetch(`${baseUrl}/orders/order-1`);
    expect(res.status).toBe(200);

    const body = await asJson<{ id: string; status: string; payment: string }>(res);
    expect(body.id).toBe('order-1');
    expect(body.status).toBe('CONFIRMED');
    expect(body.payment).toBe('SUCCEEDED');
  });

  it('GET /orders/:id — 404 when order-service has no such order', async () => {
    const res = await fetch(`${baseUrl}/orders/missing-order`);
    expect(res.status).toBe(404);
  });

  it('partial-failure tolerant: payment-service down → order is still returned with payment: "unavailable"', async () => {
    const toggled = await fetch(`${process.env.PAYMENT_SERVICE_URL}/debug/down`, { method: 'PUT' });
    expect(toggled.status).toBe(204);

    try {
      const res = await fetch(`${baseUrl}/orders/order-1`);
      expect(res.status).toBe(200); // the request as a whole still succeeds

      const body = await asJson<{ id: string; status: string; payment: string }>(res);
      expect(body.id).toBe('order-1');
      expect(body.status).toBe('CONFIRMED'); // order data is intact
      expect(body.payment).toBe('unavailable'); // degraded, not failed
    } finally {
      await fetch(`${process.env.PAYMENT_SERVICE_URL}/debug/up`, { method: 'PUT' });
    }
  });
});
