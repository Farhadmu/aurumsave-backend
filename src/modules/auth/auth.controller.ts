import { Controller, Post, Body, Get, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, ChangePasswordDto } from './auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new customer or staff member' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    const result = await this.authService.register(dto, ip, ua);
    return {
      success: true,
      message: 'Account created successfully',
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user and return JWT bearer token' })
  @ApiResponse({ status: 200, description: 'User successfully authenticated' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    const result = await this.authService.login(dto, ip, ua);
    return {
      success: true,
      message: 'Login successful',
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('seed-demo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Provision or repair default evaluation accounts for the 6 demo platform roles' })
  async seedDemo() {
    await this.authService.ensureSeedUsers();
    return {
      success: true,
      message: 'Demo evaluation accounts ensured successfully for all 6 platform roles',
      accounts: AuthService.DEMO_USERS.map((u) => ({
        role: u.role,
        email: u.email,
        password: u.password,
        fullName: u.fullName,
      })),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('demo-accounts')
  @ApiOperation({ summary: 'Get list of active demo evaluation accounts for platform testing' })
  getDemoAccounts() {
    return {
      success: true,
      accounts: AuthService.DEMO_USERS.map((u) => ({
        role: u.role,
        email: u.email,
        password: u.password,
        fullName: u.fullName,
      })),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  async getProfile(@CurrentUser() user: any) {
    return {
      success: true,
      data: user,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get full profile details including address, nominee, and banking' })
  async getFullProfile(@CurrentUser('id') userId: string) {
    const result = await this.authService.getProfileWithDetails(userId);
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update customer personal profile, address, and payout details' })
  async updateProfile(@CurrentUser('id') userId: string, @Body() dto: any) {
    const result = await this.authService.updateProfile(userId, dto);
    return {
      success: true,
      message: 'Profile updated successfully',
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password for authenticated user' })
  async changePassword(@CurrentUser('id') userId: string, @Body() dto: ChangePasswordDto) {
    const result = await this.authService.changePassword(userId, dto);
    return {
      success: true,
      message: result.message,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset token for account recovery' })
  async forgotPassword(@Body('email') email: string) {
    const result = await this.authService.forgotPassword(email);
    return {
      ...result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset account password using verified token' })
  async resetPassword(@Body('token') token: string, @Body('newPassword') newPass: string) {
    const result = await this.authService.resetPassword(token, newPass);
    return {
      success: true,
      message: result.message,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('verify-email')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify account email address' })
  async verifyEmail(@CurrentUser('id') userId: string, @Body('token') token?: string) {
    const result = await this.authService.verifyEmail(userId, token);
    return {
      success: true,
      message: result.message,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Explicitly logout and terminate current authenticated session' })
  async logout(@CurrentUser('id') userId: string, @CurrentUser('role') role: any) {
    const result = await this.authService.logout(userId, role);
    return {
      ...result,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('security')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get customer personal security center details, active session, and checklist' })
  async getSecurity(@CurrentUser('id') userId: string, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    const data = await this.authService.getSecurityCenterData(userId, ip, ua);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('freeze')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Immediately freeze account and halt all trading/withdrawals' })
  async freezeAccount(
    @CurrentUser('id') userId: string,
    @Body('reason') reason: string,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    const ua = req.headers['user-agent'];
    const result = await this.authService.freezeAccount(userId, reason, ip, ua);
    return {
      ...result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('unfreeze')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unfreeze account (Super Admin or re-authenticated recovery)' })
  async unfreezeAccount(
    @CurrentUser('id') actorId: string,
    @CurrentUser('role') actorRole: any,
    @Body('userId') targetUserId?: string,
  ) {
    const userIdToUnfreeze = targetUserId || actorId;
    const result = await this.authService.unfreezeAccount(userIdToUnfreeze, actorId, actorRole);
    return {
      ...result,
      timestamp: new Date().toISOString(),
    };
  }
}

