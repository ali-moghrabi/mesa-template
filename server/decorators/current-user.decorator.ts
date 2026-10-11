import {
  createParamDecorator,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Types } from 'mongoose';
import type { Role } from 'lib/constants/roles';

export type CurrentActor = { id: string; role: Role; name: string };

type RequestUser = {
  _id?: Types.ObjectId | string;
  id?: string;
  role?: Role;
  firstName?: string;
  lastName?: string;
};

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): CurrentActor => {
    const user = context
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>().user;

    const id = user?._id?.toString() ?? user?.id;
    if (!id || !user?.role) throw new UnauthorizedException();
    return {
      id,
      role: user.role,
      name: [user.firstName, user.lastName].filter(Boolean).join(' '),
    };
  },
);
