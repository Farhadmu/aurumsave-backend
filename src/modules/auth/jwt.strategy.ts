import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../database/schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {
    const isProd = configService.get<string>('NODE_ENV') === 'production';
    const secret = configService.get<string>('JWT_SECRET');
    const defaultSecret = 'aurumsave_fintech_production_super_secret_jwt_key_2026';
    const finalSecret = isProd ? (secret || defaultSecret) : (secret || defaultSecret);

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: finalSecret,
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    const user = await this.userModel.findById(payload.sub).lean();
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is invalid or deactivated');
    }

    return {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      kycStatus: user.kycStatus,
    };
  }
}
