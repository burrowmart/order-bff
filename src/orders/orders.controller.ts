import { Controller, Get, Headers, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { forwardAuthHeaders } from '../common/auth/forward-auth-headers.helper';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get(':id')
  @ApiOkResponse({
    description: 'Order detail + payment status, aggregated. A payment-service outage degrades gracefully: the order is still returned with payment: "unavailable".',
  })
  getOrder(@Param('id') id: string, @Headers() headers: Record<string, string>) {
    return this.service.getOrderDetail(id, forwardAuthHeaders(headers));
  }
}
