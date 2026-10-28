import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { Role } from 'lib/constants/roles';
import { mfaMissing } from 'lib/security/mfa-policy';
import { mfaSetupRequired } from './permission.guard';

@Injectable()
export class TeamMfaGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context
      .switchToHttp()
      .getRequest<
        Request & { user?: { role?: Role; mfaEnabled?: boolean } }
      >().user;
    if (mfaMissing(user)) throw mfaSetupRequired();
    return true;
  }
}
