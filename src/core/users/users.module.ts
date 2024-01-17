import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { UsersRepository } from './repositories/users.repository';

@Module({
  imports: [DatabaseModule],
  providers: [UsersRepository],
  exports: [UsersRepository],
})
export class UsersModule {}
