export class CreateSyncDto {
  name!: string;
  description?: string;
  source_integration_id!: string;
  source_type!: string;
  source_config!: Record<string, unknown>;
  destination_integration_id!: string;
  destination_type!: string;
  destination_config!: Record<string, unknown>;
  direction!: 'one_way' | 'bidirectional';
  conflict_resolution!: 'last_write_wins' | 'manual';
  field_mapping!: Record<string, unknown>;
  filter_config?: Record<string, unknown>;
}
