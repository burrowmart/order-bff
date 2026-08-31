import * as Joi from 'joi';
import { SERVICE_NAME } from '../constants';

export const envValidationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  // Test-only identity bypass — the guard only extracts identity, never
  // verifies signatures (that is the Envoy PEP's job; see jwt.guard.ts)
  AUTH_DISABLED: Joi.string().valid('true', 'false').default('false'),
  // Observability
  OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string().uri().optional(),
  OTEL_SERVICE_NAME: Joi.string().default(SERVICE_NAME),
  // Downstream services this BFF aggregates
  ORDER_SERVICE_URL: Joi.string().default('http://localhost:3003'),
  PAYMENT_SERVICE_URL: Joi.string().default('http://localhost:3004'),
});
