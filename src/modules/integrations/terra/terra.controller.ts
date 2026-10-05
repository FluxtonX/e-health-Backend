import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { TerraService } from './terra.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Controller('integrations/terra')
export class TerraController {
  constructor(private readonly terraService: TerraService) {}

  /**
   * Terra Webhook Receiver
   * Processes asynchronous health telemetry payloads from Oura, Whoop, Garmin, etc.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() payload: any,
    @Headers('terra-signature') signatureHeader?: string,
  ) {
    const rawBody = JSON.stringify(payload);
    const isValid = this.terraService.verifyWebhookSignature(
      rawBody,
      signatureHeader,
    );

    if (!isValid) {
      throw new UnauthorizedException(
        'Invalid or expired Terra webhook HMAC signature',
      );
    }

    return this.terraService.processWebhook(payload);
  }

  /**
   * Returns supported third-party wearable brands
   */
  @Get('providers')
  getSupportedProviders() {
    return {
      success: true,
      providers: this.terraService.getSupportedProviders(),
    };
  }

  /**
   * Generates a widget onboarding session for an authenticated member
   */
  @Post('widget-session')
  @UseGuards(JwtAuthGuard)
  async createWidgetSession(
    @CurrentUser('id') userId: string,
    @Body('providers') providers?: string[],
  ) {
    const session = await this.terraService.generateWidgetSession(
      userId,
      providers,
    );
    return {
      success: true,
      data: session,
    };
  }

  /**
   * Status and readiness check
   */
  @Get('status')
  getStatus() {
    return {
      status: 'operational',
      service: 'Terra API Health Aggregator',
      webhookEndpoint: '/v1/integrations/terra/webhook',
      timestamp: new Date().toISOString(),
    };
  }
}
