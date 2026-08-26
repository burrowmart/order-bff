export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  cognito: {
    issuer: process.env.COGNITO_ISSUER ?? '',
    audience: process.env.COGNITO_AUDIENCE ?? '',
  },
  orderServiceUrl: process.env.ORDER_SERVICE_URL ?? 'http://localhost:3003',
  paymentServiceUrl: process.env.PAYMENT_SERVICE_URL ?? 'http://localhost:3004',
});
