import type { Server } from 'node:http';

export default async function globalTeardown(): Promise<void> {
  const orders = (global as { __ORDER_STUB__?: Server }).__ORDER_STUB__;
  const payments = (global as { __PAYMENT_STUB__?: Server }).__PAYMENT_STUB__;
  await Promise.all([
    new Promise<void>((resolve) => (orders ? orders.close(() => resolve()) : resolve())),
    new Promise<void>((resolve) => (payments ? payments.close(() => resolve()) : resolve())),
  ]);
}
