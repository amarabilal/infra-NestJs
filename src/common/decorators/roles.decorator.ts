import { SetMetadata } from '@nestjs/common';
import { PlayerRole } from '../../players/entities/player.entity';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: PlayerRole[]) => SetMetadata(ROLES_KEY, roles);
