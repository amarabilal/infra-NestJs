import { JwtModuleOptions } from '@nestjs/jwt';

export const jwtConfig = (): JwtModuleOptions => {
  const expiresIn = process.env.JWT_EXPIRES_IN ?? '7d';
  return {
    secret: process.env.JWT_SECRET ?? 'fallback_secret',
    signOptions: {
      expiresIn: expiresIn as unknown as number,
    },
  };
};
