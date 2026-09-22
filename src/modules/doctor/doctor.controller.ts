import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { DoctorService } from './doctor.service';
import { CreateDoctorNoteDto } from './dto/create-doctor-note.dto';
import { UpdateConsentDto } from './dto/update-consent.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Doctor & Clinical Care')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('doctor')
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get assigned doctor overview and telemetry review status' })
  async getOverview(@CurrentUser('id') userId: string) {
    return this.doctorService.getOverview(userId);
  }

  @Get('notes')
  @ApiOperation({ summary: 'Get clinician consultation notes and recommendations' })
  async getNotes(@CurrentUser('id') userId: string) {
    return this.doctorService.getNotes(userId);
  }

  @Post('notes')
  @Roles(UserRole.DOCTOR, UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Add a new clinical consultation note (Clinician role required)' })
  async createNote(
    @CurrentUser('id') doctorId: string,
    @Body() dto: CreateDoctorNoteDto,
  ) {
    return this.doctorService.createNote(doctorId, dto);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get shared clinical laboratory and telemetry audit reports' })
  async getReports(@CurrentUser('id') userId: string) {
    return this.doctorService.getSharedReports(userId);
  }

  @Get('consent')
  @ApiOperation({ summary: 'Get granular patient clinician telemetry sharing boundaries' })
  async getConsent(@CurrentUser('id') userId: string) {
    return this.doctorService.getConsentSettings(userId);
  }

  @Put('consent')
  @ApiOperation({ summary: 'Update patient clinician telemetry sharing boundaries' })
  async updateConsent(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateConsentDto,
  ) {
    return this.doctorService.updateConsentSettings(userId, dto);
  }
}
