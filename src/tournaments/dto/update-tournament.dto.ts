import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsDateString,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TournamentStatus } from '../entities/tournament.entity';

export class UpdateTournamentDto {
  @ApiPropertyOptional({ example: 'Updated Tournament Name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 16 })
  @IsOptional()
  @IsInt()
  @Min(2)
  maxPlayers?: number;

  @ApiPropertyOptional({ example: '2025-12-15T18:00:00Z' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ enum: TournamentStatus })
  @IsOptional()
  @IsEnum(TournamentStatus)
  status?: TournamentStatus;
}
