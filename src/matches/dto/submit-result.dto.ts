import { IsString, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitResultDto {
  @ApiProperty({ example: 'uuid-of-winner' })
  @IsUUID()
  winnerId!: string;

  @ApiProperty({ example: '3-1' })
  @IsString()
  @IsNotEmpty()
  score!: string;
}
