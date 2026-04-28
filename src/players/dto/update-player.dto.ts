import { IsString, MinLength, MaxLength, IsOptional, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePlayerDto {
  @ApiPropertyOptional({ example: 'new_username' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  username?: string;

  @ApiPropertyOptional({ example: 'https://example.com/new-avatar.png' })
  @IsOptional()
  @IsUrl()
  avatar?: string;
}
