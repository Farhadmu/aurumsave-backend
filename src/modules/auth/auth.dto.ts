import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@aurumsave/shared';

export class RegisterDto {
  @ApiProperty({ example: 'customer@aurumsave.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Pass1234#Strong!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Mohammad Rahim' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiPropertyOptional({ example: '+8801712345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: Role, default: Role.CUSTOMER })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

export class LoginDto {
  @ApiProperty({ example: 'customer@aurumsave.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Pass1234#Strong!' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  occupation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  address?: {
    addressLine1?: string;
    city?: string;
    district?: string;
    division?: string;
    postalCode?: string;
  };

  @ApiPropertyOptional()
  @IsOptional()
  nominee?: {
    name: string;
    relationship: string;
    phone: string;
  };

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  preferredBkashNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  bankDetails?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    branchName: string;
    routingNumber: string;
  };
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'customer@aurumsave.com' })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;
}
