import { Controller, Post, Get, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@aurumsave/shared';
import { OrderService } from './order.service';
import { CreateOrderDto, FilterOrdersDto } from './order.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order from a locked quote' })
  async createOrder(@CurrentUser('id') userId: string, @Body() dto: CreateOrderDto) {
    const order = await this.orderService.createOrder(userId, dto);
    return {
      success: true,
      message: 'Order created successfully',
      data: order,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('all')
  @Roles(Role.FINANCE_OFFICER, Role.ADMIN, Role.SUPER_ADMIN, Role.AUDITOR)
  @ApiOperation({ summary: 'List all platform orders for Operations & Finance reconciliation' })
  async getAllOrders(@Query() filter: FilterOrdersDto) {
    const result = await this.orderService.getAllOrders(filter);
    return {
      success: true,
      data: result.orders,
      meta: { total: result.total, limit: result.limit, skip: result.skip },
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  @ApiOperation({ summary: 'List customer orders with optional status filter' })
  async getMyOrders(@CurrentUser('id') userId: string, @Query() filter: FilterOrdersDto) {
    const result = await this.orderService.getCustomerOrders(userId, filter);
    return {
      success: true,
      data: result.orders,
      meta: { total: result.total, limit: result.limit, skip: result.skip },
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order details by order ID' })
  async getOrderById(@Param('id') orderId: string, @CurrentUser() user: any) {
    const order = await this.orderService.getOrderById(orderId, user);
    return {
      success: true,
      data: order,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/settle-payout')
  @Roles(Role.FINANCE_OFFICER, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Settle liquidation payout for sell orders (Finance & Admin only)' })
  async settlePayout(
    @Param('id') orderId: string,
    @Body('payoutReference') payoutReference: string,
    @CurrentUser('id') officerId: string,
    @CurrentUser('role') officerRole: any,
  ) {
    const order = await this.orderService.settleSellOrderPayout(
      orderId,
      officerId,
      officerRole,
      payoutReference,
    );
    return {
      success: true,
      message: 'Sell order payout settled and gold liquidated cleanly',
      data: order,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel an unpaid order or pending sell order' })
  async cancelOrder(@Param('id') orderId: string, @CurrentUser('id') userId: string) {
    const order = await this.orderService.cancelOrder(orderId, userId);
    return {
      success: true,
      message: 'Order cancelled',
      data: order,
      timestamp: new Date().toISOString(),
    };
  }
}
