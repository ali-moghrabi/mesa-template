import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { Model } from 'mongoose';
import { Request } from 'express';
import { ACCESS_TOKEN_NAME } from 'lib/constants/authConstants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {
    const jwtSecret = process.env.JWT_ACCESS_SECRET;

    if (!jwtSecret) {
      throw new Error('Missing JWT_ACCESS_SECRET environment variable');
    }

    super({
      jwtFromRequest: (req: Request) => {
        const cookieToken = (req.cookies as Record<string, string>)[
          ACCESS_TOKEN_NAME
        ];

        if (cookieToken) return cookieToken;

        const authHeader = req.headers?.authorization || '';
        const [, token] = authHeader.split(' ');

        return token || null;
      },
      secretOrKey: jwtSecret,
      passReqToCallback: true,
    });
  }

  async validate(_req: Request, payload: { sub: string }): Promise<User> {
    const user = await this.userModel.findById(payload.sub).select('-password');

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return user;
  }
}
