import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SupportTicket, SupportTicketSchema } from '../../database/schemas/support-ticket.schema';
import { SupportMessage, SupportMessageSchema } from '../../database/schemas/support-message.schema';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SupportTicket.name, schema: SupportTicketSchema },
      { name: SupportMessage.name, schema: SupportMessageSchema },
    ]),
  ],
  controllers: [SupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
