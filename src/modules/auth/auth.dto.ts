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
