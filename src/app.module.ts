import { RedisModule } from '@nestjs-modules/ioredis';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CoreModule } from './core/core.module';
import { DatabaseModule } from './database/database.module';
import { IntegrationsModule } from './integrations/integrations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ cache: true }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.getOrThrow<string>('REDIS_HOST'),
          port: +configService.getOrThrow<number>('REDIS_PORT'),
          username: configService.getOrThrow<string>('REDIS_USERNAME'),
          password: configService.getOrThrow<string>('REDIS_PASSWORD'),
        },
      }),
    }),
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        type: 'single',
        options: {
          host: configService.getOrThrow<string>('REDIS_HOST'),
          port: +configService.getOrThrow<number>('REDIS_PORT'),
          username: configService.getOrThrow<string>('REDIS_USERNAME'),
          password: configService.getOrThrow<string>('REDIS_PASSWORD'),
        },
      }),
    }),
    CoreModule,
    DatabaseModule,
    IntegrationsModule,
  ],
})
export class AppModule {}
