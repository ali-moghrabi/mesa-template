import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  hasAllPermissions,
  type Permission,
  type Role,
} from 'lib/constants/roles';
import { mfaMissing } from 'lib/security/mfa-policy';

export const PERMISSIONS_KEY = 'permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest<
      Request & {
        user?: { role?: Role; isActive?: boolean; mfaEnabled?: boolean };
      }
    >().user;

    if (
      !user ||
      user.isActive === false ||
      !hasAllPermissions(user.role, required)
    ) {
      throw new ForbiddenException('You do not have permission to do this');
    }
    if (mfaMissing(user)) throw mfaSetupRequired();
    return true;
  }
}

export const mfaSetupRequired = () =>
  new ForbiddenException({
    statusCode: 403,
    code: 'MFA_SETUP_REQUIRED',
    message:
      'Set up two-step sign-in on your account page to use the admin panel.',
  });
