import { IsString, IsOptional, IsDateString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateGameDto {
  @ApiPropertyOptional({ example: 'Street Fighter 6 Championship Edition' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'Capcom' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  publisher?: string;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  @ApiPropertyOptional({ example: 'Fighting' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  genre?: string;
}
