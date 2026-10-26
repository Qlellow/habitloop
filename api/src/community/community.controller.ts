import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../auth/auth.guard';
import { WeatherService } from './weather.service';

@Controller('community')
export class CommunityController {
  constructor(private readonly weather: WeatherService) {}

  /** 커뮤니티 감정 날씨 (최근 24시간, 5분마다 새로 잰다) */
  @Public()
  @Get('weather')
  @Header('Cache-Control', 'public, max-age=60')
  now() {
    return this.weather.now();
  }
}
