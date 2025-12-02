import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sync } from './entities/sync.entity';
import { SyncStateService } from './services/sync-state.service';
import { ObjectMapping } from './entities/object-mapping.entity';

@Injectable()
export class SyncsService {
  constructor(
    @InjectRepository(Sync)
    private syncsRepository: Repository<Sync>,
    @InjectRepository(ObjectMapping)
    private objectMappingRepository: Repository<ObjectMapping>,
    private syncStateService: SyncStateService,
  ) {}

  async create(userId: string, syncData: Partial<Sync>): Promise<Sync> {
    if (!syncData.source_integration_id || !syncData.destination_integration_id) {
      throw new BadRequestException('Both source and destination integrations required');
    }

    const sync = this.syncsRepository.create({
      ...syncData,
      user_id: userId,
    });

    const createdSync = await this.syncsRepository.save(sync);

    // Initialize sync state
    await this.syncStateService.getOrCreate(createdSync.id);

    return createdSync;
  }

  async findById(id: string): Promise<Sync | null> {
    return this.syncsRepository.findOne({
      where: { id },
      relations: ['source_integration', 'destination_integration'],
    });
  }

  async findByUser(userId: string): Promise<Sync[]> {
    return this.syncsRepository.find({
      where: { user_id: userId },
      relations: ['source_integration', 'destination_integration'],
      order: { created_at: 'DESC' },
    });
  }

  async update(id: string, updateData: Partial<Sync>): Promise<Sync> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    await this.syncsRepository.update({ id }, updateData as any);
    const sync = await this.findById(id);
    if (!sync) {
      throw new NotFoundException('Sync not found');
    }
    return sync;
  }

  async delete(id: string): Promise<void> {
    await this.syncsRepository.update(id, { deleted_at: new Date() });
  }

  async getStatus(syncId: string) {
    const sync = await this.findById(syncId);
    if (!sync) {
      throw new NotFoundException('Sync not found');
    }

    const state = await this.syncStateService.findBySyncId(syncId);

    return {
      id: sync.id,
      name: sync.name,
      status: sync.status,
      lastSyncAt: state?.last_sync_at,
      nextSyncAt: null, // Would be calculated based on polling interval
      conflictCount: state?.conflict_count || 0,
      retryCount: state?.retry_count || 0,
      lastError: sync.last_error,
    };
  }

  async createObjectMapping(syncId: string, mappingData: Partial<ObjectMapping>) {
    const mapping = this.objectMappingRepository.create({
      ...mappingData,
      sync_id: syncId,
    });
    return this.objectMappingRepository.save(mapping);
  }

  async findObjectMapping(syncId: string, sourceId: string, destId: string) {
    return this.objectMappingRepository.findOneBy({
      sync_id: syncId,
      source_object_id: sourceId,
      destination_object_id: destId,
    });
  }

  async findObjectMappingBySource(syncId: string, sourceId: string) {
    return this.objectMappingRepository.findOneBy({
      sync_id: syncId,
      source_object_id: sourceId,
    });
  }

  async updateObjectMapping(id: string, updates: Partial<ObjectMapping>) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    await this.objectMappingRepository.update({ id }, updates as any);
    return this.objectMappingRepository.findOneBy({ id });
  }
}
