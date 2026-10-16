import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { CustomerProfile, CustomerProfileSchema } from '../../database/schemas/customer-profile.schema';
import { GoldHolding, GoldHoldingSchema } from '../../database/schemas/gold-holding.schema';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get<string>('NODE_ENV') === 'production';
        const secret = config.get<string>('JWT_SECRET');
        const defaultSecret = 'aurumsave_fintech_production_super_secret_jwt_key_2026';

        if (isProd) {
          if (!secret || secret.trim() === '' || secret === defaultSecret || secret.length < 32) {
            throw new Error(
              'Production startup rejected: JWT_SECRET must be configured with a cryptographically strong secret of at least 32 characters in production.',
            );
          }
          return {
            secret,
            signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '1d') },
          };
        }

        return {
          secret: secret || defaultSecret,
          signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d') },
        };
      },
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: CustomerProfile.name, schema: CustomerProfileSchema },
      { name: GoldHolding.name, schema: GoldHoldingSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
