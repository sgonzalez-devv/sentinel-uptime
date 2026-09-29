import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Check } from './entities/check.entity';
import { ChecksService } from './checks.service';

@Module({
  imports: [TypeOrmModule.forFeature([Check])],
  providers: [ChecksService],
  exports: [ChecksService],
})
export class ChecksModule {}
