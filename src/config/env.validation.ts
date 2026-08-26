import * as Joi from 'joi';
import { SERVICE_NAME } from '../constants';

export const envValidationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  // Auth — required unless AUTH_DISABLED=true (used in tests)
  AUTH_DISABLED: Joi.string().valid('true', 'false').default('false'),
  COGNITO_ISSUER: Joi.string().when('AUTH_DISABLED', {
    is: 'true',
    then: Joi.string().optional().allow(''),
    otherwise: Joi.string().required(),
  }),
  COGNITO_AUDIENCE: Joi.string().when('AUTH_DISABLED', {
    is: 'true',
    then: Joi.string().optional().allow(''),
    otherwise: Joi.string().required(),
  }),
  // Observability
  OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string().uri().optional(),
  OTEL_SERVICE_NAME: Joi.string().default(SERVICE_NAME),
  // Downstream services this BFF aggregates
  ORDER_SERVICE_URL: Joi.string().default('http://localhost:3003'),
  PAYMENT_SERVICE_URL: Joi.string().default('http://localhost:3004'),
});
