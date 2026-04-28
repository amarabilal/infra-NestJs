import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  IsDateString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTournamentDto {
  @ApiProperty({ example: 'World Championship 2025' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 8 })
  @IsInt()
  @Min(2)
  maxPlayers!: number;

  @ApiProperty({ example: '2025-12-01T18:00:00Z' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: 'uuid-of-game' })
  @IsUUID()
  gameId!: string;
}
