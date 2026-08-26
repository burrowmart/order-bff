import { BadGatewayException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { OrdersService } from '../src/orders/orders.service';

const configValues: Record<string, unknown> = {
  orderServiceUrl: 'http://order-service.test',
  paymentServiceUrl: 'http://payment-service.test',
};
const config = { get: (key: string) => configValues[key] } as unknown as ConfigService;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: { get: () => 'application/json' },
    json: async () => body,
  } as unknown as Response;
}

const ORDER = {
  id: 'order-1',
  userEmail: 'alice@example.com',
  items: [{ sku: 'sku-1', qty: 2, price: 100 }],
  total: 200,
  status: 'CONFIRMED',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('OrdersService', () => {
  let service: OrdersService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    service = new OrdersService(config);
    fetchMock = jest.fn();
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  });

  it('aggregates order + payment status when both services answer', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('order-service')) return jsonResponse(200, ORDER);
      return jsonResponse(200, {
        data: [{ id: 'pay-1', orderId: 'order-1', userId: 'alice@example.com', amount: 200, status: 'SUCCEEDED', createdAt: '', updatedAt: '' }],
        total: 1,
        page: 1,
        limit: 1,
      });
    });

    const result = await service.getOrderDetail('order-1', {});

    expect(result.id).toBe('order-1');
    expect(result.payment).toBe('SUCCEEDED');
  });

  it('returns payment: "none" when the order has no payment record yet', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('order-service')) return jsonResponse(200, ORDER);
      return jsonResponse(200, { data: [], total: 0, page: 1, limit: 1 });
    });

    const result = await service.getOrderDetail('order-1', {});

    expect(result.payment).toBe('none');
  });

  it('partial-failure tolerant: payment-service down → order is still returned with payment: "unavailable"', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('order-service')) return jsonResponse(200, ORDER);
      throw new Error('ECONNREFUSED');
    });

    const result = await service.getOrderDetail('order-1', {});

    expect(result.id).toBe('order-1');
    expect(result.status).toBe('CONFIRMED');
    expect(result.payment).toBe('unavailable');
  });

  it('order-service is essential: a 404 there fails the whole request, regardless of payment-service', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('order-service')) return jsonResponse(404, { message: 'not found' });
      return jsonResponse(200, { data: [], total: 0, page: 1, limit: 1 });
    });

    await expect(service.getOrderDetail('missing', {})).rejects.toThrow(NotFoundException);
  });

  it('order-service unreachable → BadGatewayException', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('order-service')) throw new Error('ECONNREFUSED');
      return jsonResponse(200, { data: [], total: 0, page: 1, limit: 1 });
    });

    await expect(service.getOrderDetail('order-1', {})).rejects.toThrow(BadGatewayException);
  });
});
