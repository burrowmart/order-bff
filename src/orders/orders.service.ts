import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createOrderServiceClient,
  createPaymentServiceClient,
  FetchError,
  type Order,
  type PaymentStatus,
} from '@demo/contracts';
import { getCorrelationId } from '../common/correlation/correlation.context';

export interface OrderDetailResponse extends Order {
  /** 'none' = no payment record yet (e.g. order still PENDING); 'unavailable' = payment-service didn't answer */
  payment: PaymentStatus | 'unavailable' | 'none';
}

@Injectable()
export class OrdersService {
  constructor(private readonly config: ConfigService) {}

  // Fresh client per call: correlationId lives in AsyncLocalStorage and
  // changes per request. authHeaders forwards the caller's own credential —
  // both downstream services independently verify the Cognito JWT (global
  // guard), so a request arriving without it would 401 in a real deployment.
  private orderClient(authHeaders: Record<string, string>) {
    return createOrderServiceClient({
      baseUrl: this.config.get<string>('orderServiceUrl')!,
      defaultHeaders: { ...authHeaders, ...this.correlationHeaders() },
    });
  }

  private paymentClient(authHeaders: Record<string, string>) {
    return createPaymentServiceClient({
      baseUrl: this.config.get<string>('paymentServiceUrl')!,
      defaultHeaders: { ...authHeaders, ...this.correlationHeaders() },
    });
  }

  private correlationHeaders(): Record<string, string> {
    const id = getCorrelationId();
    return id ? { 'x-correlation-id': id } : {};
  }

  /**
   * order-service is essential — no order, no response, so its failure
   * propagates. payment-service is fetched in parallel (Promise.allSettled,
   * not Promise.all) and treated as optional: a payment-service outage still
   * returns the order with payment: 'unavailable' instead of failing the
   * whole request — this is the partial-failure tolerance the architecture
   * calls for.
   */
  async getOrderDetail(id: string, authHeaders: Record<string, string>): Promise<OrderDetailResponse> {
    const [orderResult, paymentResult] = await Promise.allSettled([
      this.orderClient(authHeaders).getOrder(id),
      this.paymentClient(authHeaders).listPayments({ orderId: id, limit: 1 }),
    ]);

    if (orderResult.status === 'rejected') {
      if (orderResult.reason instanceof FetchError && orderResult.reason.status === 404) {
        throw new NotFoundException(`Order ${id} not found`);
      }
      throw new BadGatewayException('order-service unavailable');
    }

    const payment: OrderDetailResponse['payment'] =
      paymentResult.status === 'fulfilled' ? (paymentResult.value.data[0]?.status ?? 'none') : 'unavailable';

    return { ...orderResult.value, payment };
  }
}
