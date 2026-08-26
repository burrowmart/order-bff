/**
 * Generates openapi.yaml from the NestJS Swagger module metadata.
 *
 * Run from the order-bff directory: npm run generate:openapi
 *
 * The emitted openapi.yaml is committed to the repo as the as-built view of
 * what this service actually serves. It is NOT the client-generator input:
 * contracts' generate-clients.ts reads the hand-authored design specs in
 * contracts/openapi/, never a service's own file — keep the two in agreement.
 */
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';
import { AppModule } from '../src/app.module';

process.env.AUTH_DISABLED ??= 'true';

async function generate(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('Order BFF API')
    .setDescription('Thin REST aggregation BFF over order-service + payment-service. Partial-failure tolerant: a payment-service outage still returns the order. Holds no domain logic and no datastore.')
    .setVersion('0.1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const outPath = join(__dirname, '..', 'openapi.yaml');
  writeFileSync(outPath, yaml.dump(document, { lineWidth: 120, noRefs: true }));
  console.log(`openapi.yaml written to ${outPath}`);

  await app.close();
  process.exit(0);
}

generate().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
