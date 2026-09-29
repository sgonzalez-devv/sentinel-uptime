import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MonitorsService } from './monitors.service';
import { CreateMonitorDto } from './dto/create-monitor.dto';
import { User } from '../auth/entities/user.entity';

@Controller('monitors')
@UseGuards(JwtAuthGuard)
export class MonitorsController {
  constructor(private readonly monitorsService: MonitorsService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateMonitorDto) {
    return this.monitorsService.create(user, dto);
  }

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.monitorsService.findAll(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.monitorsService.findOne(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateMonitorDto>,
  ) {
    return this.monitorsService.update(user, id, dto);
  }

  @Patch(':id/toggle')
  toggle(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.monitorsService.togglePause(user, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.monitorsService.remove(user, id);
  }

  @Get(':id/metrics')
  getMetrics(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.monitorsService.getMetrics(user, id, days);
  }
}
