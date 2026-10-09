import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'guards/jwt.guard';
import { PERMISSIONS_KEY, PermissionsGuard } from 'guards/permission.guard';
import type { Permission } from 'lib/constants/roles';

export const Authorize = (...permissions: Permission[]) =>
  applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    UseGuards(JwtAuthGuard, PermissionsGuard),
  );
