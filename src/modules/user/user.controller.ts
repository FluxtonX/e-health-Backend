import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateConsentDto } from './dto/update-consent.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('User Profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current member profile and demographics' })
  @ApiResponse({
    status: 200,
    description: 'Profile data retrieved successfully',
  })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.userService.getProfile(userId);
  }

  @Put('profile')
  @ApiOperation({
    summary: 'Update member profile, demographics, and contact info',
  })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(userId, dto);
  }

  @Get('consent')
  @ApiOperation({
    summary: 'Get member consent preferences',
  })
  @ApiResponse({ status: 200, description: 'Consent retrieved successfully' })
  async getConsent(@CurrentUser('id') userId: string) {
    return this.userService.getConsent(userId);
  }

  @Put('consent')
  @ApiOperation({
    summary: 'Update member consent preferences',
  })
  @ApiResponse({ status: 200, description: 'Consent updated successfully' })
  async updateConsent(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateConsentDto,
  ) {
    return this.userService.updateConsent(userId, dto);
  }
}
