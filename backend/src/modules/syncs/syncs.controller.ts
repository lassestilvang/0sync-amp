import { Controller, Get, Post, Put, Delete, UseGuards, Param, Body, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SyncsService } from './syncs.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { CreateSyncDto } from './dto/create-sync.dto';

@ApiTags('syncs')
@ApiBearerAuth()
@Controller('syncs')
@UseGuards(AuthGuard('jwt'))
export class SyncsController {
  constructor(private syncsService: SyncsService) {}

  @Get()
  @ApiOperation({ summary: 'List all syncs for the current user' })
  @ApiResponse({ status: 200, description: 'Return all syncs' })
  async list(@CurrentUser() user: User) {
    return this.syncsService.findByUser(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new sync' })
  @ApiResponse({ status: 201, description: 'Sync created' })
  async create(@CurrentUser() user: User, @Body() createSyncDto: CreateSyncDto) {
    return this.syncsService.create(user.id, createSyncDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single sync by ID' })
  @ApiResponse({ status: 200, description: 'Return the sync' })
  @ApiResponse({ status: 404, description: 'Sync not found' })
  async getOne(@Param('id') id: string) {
    return this.syncsService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an existing sync' })
  @ApiResponse({ status: 200, description: 'Sync updated' })
  async update(@Param('id') id: string, @Body() updateData: Record<string, unknown>) {
    return this.syncsService.update(id, updateData);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a sync' })
  @ApiResponse({ status: 204, description: 'Sync deleted' })
  async delete(@Param('id') id: string) {
    return this.syncsService.delete(id);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get the status of a sync' })
  @ApiResponse({ status: 200, description: 'Return the sync status' })
  async getStatus(@Param('id') id: string) {
    return this.syncsService.getStatus(id);
  }

  @Post(':id/run')
  @HttpCode(200)
  @ApiOperation({ summary: 'Manually trigger a sync run' })
  @ApiResponse({ status: 200, description: 'Sync queued' })
  triggerSync(@Param('id') id: string) {
    // This would queue a sync job - implemented in sync engine phase
    return { message: 'Sync queued', syncId: id };
  }
}
