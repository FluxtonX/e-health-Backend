import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { DoctorService } from './doctor.service';
import { CreateDoctorNoteDto } from './dto/create-doctor-note.dto';
import { UpdateConsentDto } from '../user/dto/update-consent.dto';
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

  @Get('patients')
  @Roles(UserRole.DOCTOR, UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get patients assigned to the clinician' })
  async getPatients(@CurrentUser('id') doctorId: string) {
    return this.doctorService.getPatientsForDoctor(doctorId);
  }

  @Get('directory')
  @ApiOperation({ summary: 'Search the clinician directory' })
  async getDirectory(@Query('search') search?: string) {
    return this.doctorService.getDirectory(search);
  }

  @Post('connect/request')
  @Roles(UserRole.MEMBER)
  @ApiOperation({ summary: 'Send a connection request to a clinician' })
  async requestConnection(
    @CurrentUser('id') patientId: string,
    @Body('doctorId') doctorId: string,
  ) {
    return this.doctorService.requestConnection(patientId, doctorId);
  }

  @Post('connect/invitation')
  @Roles(UserRole.MEMBER)
  @ApiOperation({
    summary: 'Connect to a clinician using an invitation link/code',
  })
  async connectByInvitation(
    @CurrentUser('id') patientId: string,
    @Body('code') code: string,
  ) {
    return this.doctorService.connectByInvitation(patientId, code);
  }

  @Get('overview')
  @ApiOperation({
    summary: 'Get assigned doctor overview and telemetry review status',
  })
  async getOverview(
    @CurrentUser() user: any,
    @Query('patientId') patientId?: string,
  ) {
    await this.authorizePatientRequest(user, patientId, 'doctor_overview');
    const targetId =
      user.role === UserRole.DOCTOR && patientId ? patientId : user.id;
    return this.doctorService.getOverview(targetId);
  }

  @Get('notes')
  @ApiOperation({
    summary: 'Get clinician consultation notes and recommendations',
  })
  async getNotes(
    @CurrentUser() user: any,
    @Query('patientId') patientId?: string,
  ) {
    await this.authorizePatientRequest(user, patientId, 'clinical_notes');
    if (user.role === UserRole.DOCTOR && !patientId) {
      return this.doctorService.getAllNotesForDoctor(user.id);
    }
    const targetId =
      user.role === UserRole.DOCTOR && patientId ? patientId : user.id;
    return this.doctorService.getNotes(targetId);
  }

  @Post('notes')
  @Roles(UserRole.DOCTOR, UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Add a new clinical consultation note (Clinician role required)',
  })
  async createNote(
    @CurrentUser('id') doctorId: string,
    @Body() dto: CreateDoctorNoteDto,
  ) {
    return this.doctorService.createNote(doctorId, dto);
  }

  @Get('reports')
  @ApiOperation({
    summary: 'Get shared clinical laboratory and telemetry audit reports',
  })
  async getReports(
    @CurrentUser() user: any,
    @Query('patientId') patientId?: string,
  ) {
    await this.authorizePatientRequest(user, patientId, 'clinical_reports');
    if (user.role === UserRole.DOCTOR && !patientId) {
      return this.doctorService.getAllReportsForDoctor(user.id);
    }
    const targetId =
      user.role === UserRole.DOCTOR && patientId ? patientId : user.id;
    return this.doctorService.getSharedReports(targetId);
  }

  @Get('consent')
  @ApiOperation({
    summary: 'Get granular patient clinician telemetry sharing boundaries',
  })
  async getConsent(
    @CurrentUser() user: any,
    @Query('patientId') patientId?: string,
  ) {
    await this.authorizePatientRequest(user, patientId, 'consent_preference');
    const targetId =
      user.role === UserRole.DOCTOR && patientId ? patientId : user.id;
    return this.doctorService.getConsentSettings(targetId);
  }

  @Put('consent')
  @Roles(UserRole.MEMBER)
  @ApiOperation({
    summary: 'Update patient clinician telemetry sharing boundaries',
  })
  async updateConsent(
    @CurrentUser() user: any,
    @Body() dto: UpdateConsentDto,
  ) {
    // Consent is controlled only by the member; clinicians have no write path.
    return this.doctorService.updateConsentSettings(user.id, dto);
  }

  private async authorizePatientRequest(
    user: { id: string; role: UserRole },
    patientId: string | undefined,
    resource: string,
  ): Promise<void> {
    if (user.role === UserRole.DOCTOR && patientId) {
      await this.doctorService.assertDoctorCanAccessPatient(
        user.id,
        patientId,
        'VIEW',
        resource,
      );
    }
  }
}
