import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Env, validateEnv } from './config/env';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './features/auth/auth.module';
import { MenuModule } from './features/menu/menu.module';
import { TeamModule } from './features/team/team.module';
import { SettingsModule } from './features/settings/settings.module';
import { PromotionsModule } from './features/promotions/promotions.module';
import { GalleryModule } from './features/gallery/gallery.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        uri: config.get('MONGODB_URI', { infer: true }),
      }),
    }),
    AuthModule,
    MenuModule,
    TeamModule,
    SettingsModule,
    PromotionsModule,
    GalleryModule,
  ],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
  controllers: [AppController],
})
export class AppModule {}
