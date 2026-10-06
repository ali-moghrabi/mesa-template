import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const User = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): IUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: IUser }>();

    if (!request.user) {
      throw new Error('User not found in request');
    }

    return request.user;
  },
);
