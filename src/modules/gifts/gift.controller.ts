import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GiftService } from './gift.service';
import { SendGiftDto, LookupRecipientDto, ClaimGiftDto } from './gift.dto';

@ApiTags('P2P Gold Gifting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('gifts')
export class GiftController {
  constructor(private readonly giftService: GiftService) {}

  @Post('lookup')
  @ApiOperation({ summary: 'Secure recipient identity verification with privacy masking' })
  async lookupRecipient(
    @CurrentUser('id') userId: string,
    @Body() dto: LookupRecipientDto,
  ) {
    const data = await this.giftService.lookupRecipient(userId, dto);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Send a pure 24K gold gift to another customer' })
  async sendGift(
    @CurrentUser('id') userId: string,
    @Body() dto: SendGiftDto,
  ) {
    const data = await this.giftService.sendGift(userId, dto);
    return {
      success: true,
      message: 'Gold gift sent successfully and safely held in escrow',
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('sent')
  @ApiOperation({ summary: 'List all gold gifts sent by the authenticated customer' })
  async getSentGifts(@CurrentUser('id') userId: string) {
    const data = await this.giftService.getSentGifts(userId);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('received')
  @ApiOperation({ summary: 'List all gold gifts received or pending claim' })
  async getReceivedGifts(
    @CurrentUser() user: { id: string; email: string; phone?: string },
  ) {
    const data = await this.giftService.getReceivedGifts(user);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':giftId/accept')
  @ApiOperation({ summary: 'Accept incoming gold gift into recipient vault' })
  async acceptGift(
    @CurrentUser('id') userId: string,
    @Param('giftId') giftId: string,
    @Body() dto: ClaimGiftDto,
  ) {
    const result = await this.giftService.acceptGift(userId, giftId, dto);
    return {
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':giftId/reject')
  @ApiOperation({ summary: 'Decline incoming gold gift and auto-return to sender' })
  async rejectGift(
    @CurrentUser('id') userId: string,
    @Param('giftId') giftId: string,
  ) {
    const result = await this.giftService.rejectGift(userId, giftId);
    return {
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':giftId/cancel')
  @ApiOperation({ summary: 'Cancel pending gold gift and restore sender vault balance' })
  async cancelGift(
    @CurrentUser('id') userId: string,
    @Param('giftId') giftId: string,
  ) {
    const result = await this.giftService.cancelGift(userId, giftId);
    return {
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    };
  }
}
