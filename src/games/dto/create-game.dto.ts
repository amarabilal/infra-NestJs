import { IsString, IsNotEmpty, IsDateString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateGameDto {
  @ApiProperty({ example: 'Street Fighter 6' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'Capcom' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  publisher!: string;

  @ApiProperty({ example: '2023-06-02' })
  @IsDateString()
  releaseDate!: string;

  @ApiProperty({ example: 'Fighting' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  genre!: string;
}
