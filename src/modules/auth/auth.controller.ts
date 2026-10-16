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
}
