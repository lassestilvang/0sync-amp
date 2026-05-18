import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsObject,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSyncDto {
  @ApiProperty({ example: 'My Sync' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Synchronization between Notion and Todoist' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'uuid-of-source-integration' })
  @IsUUID()
  @IsNotEmpty()
  source_integration_id!: string;

  @ApiProperty({ example: 'notion_database' })
  @IsString()
  @IsNotEmpty()
  source_type!: string;

  @ApiProperty({ example: { database_id: '...' } })
  @IsObject()
  @IsNotEmpty()
  source_config!: Record<string, unknown>;

  @ApiProperty({ example: 'uuid-of-destination-integration' })
  @IsUUID()
  @IsNotEmpty()
  destination_integration_id!: string;

  @ApiProperty({ example: 'todoist_project' })
  @IsString()
  @IsNotEmpty()
  destination_type!: string;

  @ApiProperty({ example: { project_id: '...' } })
  @IsObject()
  @IsNotEmpty()
  destination_config!: Record<string, unknown>;

  @ApiProperty({ enum: ['one_way', 'bidirectional'], default: 'bidirectional' })
  @IsIn(['one_way', 'bidirectional'])
  direction!: 'one_way' | 'bidirectional';

  @ApiProperty({ enum: ['last_write_wins', 'manual'], default: 'last_write_wins' })
  @IsIn(['last_write_wins', 'manual'])
  conflict_resolution!: 'last_write_wins' | 'manual';

  @ApiProperty({ example: { title: 'content' } })
  @IsObject()
  @IsNotEmpty()
  field_mapping!: Record<string, unknown>;

  @ApiPropertyOptional({ example: { filter: '...' } })
  @IsObject()
  @IsOptional()
  filter_config?: Record<string, unknown>;
}
