# order-bff

## Architecture

`order-bff` is a thin REST aggregation BFF over `order-service` +
`payment-service` — it holds **no domain logic and no datastore**.

- `GET /orders/:id` = order-service's order + payment-service's payment
  status, fetched **in parallel**.
- **Partial-failure tolerant**: order-service is essential (no order, no
  response), but payment-service is optional — if it's down, the order is
  still returned with `payment: "unavailable"` instead of failing the whole
  request. See [`src/orders/orders.service.ts`](src/orders/orders.service.ts)
  (`Promise.allSettled`, not `Promise.all`).
- Forwards the caller's own Cognito credential to both downstream calls.

### Request flow

```
Client → GET /orders/:id
         ↓
OrdersController  (forwards auth header)
         ↓
OrdersService     (Promise.allSettled: order-service + payment-service)
         ↓                                    ↓
order-service GET /orders/:id      payment-service GET /payments?orderId=:id
   (essential — failure propagates)   (optional — failure → payment: "unavailable")
```

---

## Running locally

```bash
cd ../contracts && npm install && npm run build && cd -
npm install
cp .env.example .env
npm run start:dev
# http://localhost:3000, Swagger at /api
```

### Tests

```bash
npm test          # unit — OrdersService with both downstream clients mocked
npm run test:e2e  # e2e — real HTTP; includes the partial-failure proof (payment-service stub down → order still returned)
```
