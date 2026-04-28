import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Player } from '../../players/entities/player.entity';

export const CurrentPlayer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Player => {
    const request = ctx.switchToHttp().getRequest<{ user: Player }>();
    return request.user;
  },
);
