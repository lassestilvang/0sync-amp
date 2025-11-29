import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncState } from '../entities/sync-state.entity';

@Injectable()
export class SyncStateService {
  constructor(
    @InjectRepository(SyncState)
    private syncStateRepository: Repository<SyncState>,
  ) {}

  async getOrCreate(syncId: string): Promise<SyncState> {
    let state = await this.syncStateRepository.findOneBy({ sync_id: syncId });

    if (!state) {
      state = this.syncStateRepository.create({
        sync_id: syncId,
        retry_count: 0,
        conflict_count: 0,
      });
      state = await this.syncStateRepository.save(state);
    }

    return state;
  }

  async update(syncId: string, updates: Partial<SyncState>): Promise<SyncState> {
    await this.syncStateRepository.update({ sync_id: syncId }, updates);

    const state = await this.syncStateRepository.findOneBy({ sync_id: syncId });
    if (!state) {
      throw new NotFoundException('Sync state not found');
    }

    return state;
  }

  async findBySyncId(syncId: string): Promise<SyncState | null> {
    return this.syncStateRepository.findOneBy({ sync_id: syncId });
  }

  async incrementConflictCount(syncId: string): Promise<void> {
    const state = await this.findBySyncId(syncId);
    if (state) {
      await this.syncStateRepository.update(
        { sync_id: syncId },
        {
          conflict_count: state.conflict_count + 1,
          last_conflict_at: new Date(),
        },
      );
    }
  }

  async resetRetryCount(syncId: string): Promise<void> {
    await this.syncStateRepository.update({ sync_id: syncId }, { retry_count: 0 });
  }

  async incrementRetryCount(syncId: string): Promise<number> {
    const state = await this.findBySyncId(syncId);
    if (!state) {
      throw new NotFoundException('Sync state not found');
    }

    const newRetryCount = state.retry_count + 1;
    await this.syncStateRepository.update(
      { sync_id: syncId },
      {
        retry_count: newRetryCount,
        backoff_until: new Date(Date.now() + Math.pow(2, newRetryCount) * 1000),
      },
    );

    return newRetryCount;
  }
}
