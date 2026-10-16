import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, Permission, hasPermission } from '@aurumsave/shared';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) {
      throw new ForbiddenException('User authentication context or role is missing');
    }

    // Super Admin has universal access
    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    const hasAll = requiredPermissions.every((perm) => hasPermission(user.role, perm));
    if (!hasAll) {
      throw new ForbiddenException(
        `Access denied. Role ${user.role} lacks required permissions: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
