import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Tournament } from '../../tournaments/entities/tournament.entity';

@Entity('games')
export class Game {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ example: 'Street Fighter 6' })
  @Column()
  name!: string;

  @ApiProperty({ example: 'Capcom' })
  @Column()
  publisher!: string;

  @ApiProperty({ example: '2023-06-02' })
  @Column({ type: 'date' })
  releaseDate!: Date;

  @ApiProperty({ example: 'Fighting' })
  @Column()
  genre!: string;

  @ApiProperty()
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Tournament, (tournament) => tournament.game)
  tournaments!: Tournament[];
}
