export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  orderServiceUrl: process.env.ORDER_SERVICE_URL ?? 'http://localhost:3003',
  paymentServiceUrl: process.env.PAYMENT_SERVICE_URL ?? 'http://localhost:3004',
});
