import { Controller, Get, Post, Put, Delete, UseGuards, Param, Body, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SyncsService } from './syncs.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { CreateSyncDto } from './dto/create-sync.dto';

@Controller('syncs')
@UseGuards(AuthGuard('jwt'))
export class SyncsController {
  constructor(private syncsService: SyncsService) {}

  @Get()
  async list(@CurrentUser() user: User) {
    return this.syncsService.findByUser(user.id);
  }

  @Post()
  async create(@CurrentUser() user: User, @Body() createSyncDto: CreateSyncDto) {
    return this.syncsService.create(user.id, createSyncDto);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.syncsService.findById(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateData: Record<string, unknown>) {
    return this.syncsService.update(id, updateData);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string) {
    return this.syncsService.delete(id);
  }

  @Get(':id/status')
  async getStatus(@Param('id') id: string) {
    return this.syncsService.getStatus(id);
  }

  @Post(':id/run')
  @HttpCode(200)
  triggerSync(@Param('id') id: string) {
    // This would queue a sync job - implemented in sync engine phase
    return { message: 'Sync queued', syncId: id };
  }
}
