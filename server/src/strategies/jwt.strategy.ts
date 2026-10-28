import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Request } from 'express';
import { User, UserDocument } from '../schemas/user.schema';
import { Session, SessionDocument } from '../schemas/session.schema';
import {
  ACCESS_TOKEN_NAME,
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
} from 'lib/constants/authConstants';

export type AccessPayload = { sub: string; sid: string; tv: number };

export type AuthedRequest = Request & { authSessionId?: string };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
  ) {
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
        const [scheme, token] = authHeader.split(' ');

        return scheme === 'Bearer' && token ? token : null;
      },
      secretOrKey: jwtSecret,
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      passReqToCallback: true,
    });
  }

  async validate(req: AuthedRequest, payload: AccessPayload): Promise<User> {
    if (
      !Types.ObjectId.isValid(payload.sub) ||
      !Types.ObjectId.isValid(payload.sid) ||
      typeof payload.tv !== 'number'
    )
      throw new UnauthorizedException('Please sign in again');

    const [user, session] = await Promise.all([
      this.userModel
        .findOne({
          _id: payload.sub,
          tokenVersion: payload.tv === 0 ? { $in: [0, null] } : payload.tv,
        })
        .select('-password'),
      this.sessionModel.exists({ _id: payload.sid, userId: payload.sub }),
    ]);

    if (!user || !session)
      throw new UnauthorizedException('Your session has ended');
    if (user.isActive === false)
      throw new UnauthorizedException('This account is disabled');

    req.authSessionId = payload.sid;
    return user;
  }
}
