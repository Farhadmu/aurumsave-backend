import { Controller, Post, Get, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role, TicketStatus } from '@aurumsave/shared';
import { SupportService } from './support.service';
import { CreateTicketDto, AddMessageDto } from './support.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Customer Support')
@Controller('support')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Create a new support ticket' })
  async createTicket(@CurrentUser('id') userId: string, @Body() dto: CreateTicketDto) {
    const ticket = await this.supportService.createTicket(userId, dto);
    return {
      success: true,
      message: 'Support ticket opened',
      data: ticket,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('tickets')
  @ApiOperation({ summary: 'Get current customer support tickets' })
  async getMyTickets(@CurrentUser('id') userId: string) {
    const tickets = await this.supportService.getCustomerTickets(userId);
    return {
      success: true,
      data: tickets,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('queue')
  @Roles(Role.SUPPORT_AGENT, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Support staff ticket queue' })
  async getQueue(
    @Query('status') status?: TicketStatus,
    @Query('limit') limit?: number,
    @Query('skip') skip?: number,
  ) {
    const result = await this.supportService.getStaffQueue(status, limit, skip);
    return {
      success: true,
      data: result.tickets,
      meta: { total: result.total, limit: result.limit, skip: result.skip },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Get ticket details with messages (strict note isolation)' })
  async getTicketDetails(@Param('id') ticketId: string, @CurrentUser() user: any) {
    const details = await this.supportService.getTicketDetails(ticketId, user);
    return {
      success: true,
      data: details,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('tickets/:id/messages')
  @ApiOperation({ summary: 'Add a reply message or internal staff note to a ticket' })
  async addMessage(
    @Param('id') ticketId: string,
    @CurrentUser() user: any,
    @Body() dto: AddMessageDto,
  ) {
    const message = await this.supportService.addMessage(ticketId, user, dto);
    return {
      success: true,
      message: 'Message added successfully',
      data: message,
      timestamp: new Date().toISOString(),
    };
  }
}
