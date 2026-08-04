import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import { CurrentUser } from '@/shared/common/decorators/current-user.decorator';
import { AuthenticatedUser } from '@/shared/common/interfaces/authenticated-user.interface';
import { ExaminationsService } from '@/modules/clinical/application/examinations.service';
import { CreateExaminationDto } from './dto/create-examination.dto';
import { UpdateExaminationDto } from './dto/update-examination.dto';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { CreateLabTestDto } from './dto/create-lab-test.dto';
import { UpdateLabTestDto } from './dto/update-lab-test.dto';
import { renderExaminationPdf } from '@/modules/clinical/infrastructure/examination-pdf.builder';

@ApiTags('examinations')
@Controller('examinations')
export class ExaminationsController {
  constructor(private readonly examinationsService: ExaminationsService) {}

  @RequirePermissions(Permission.MEDICAL_RECORD_CREATE)
  @Post()
  create(@Body() dto: CreateExaminationDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.examinationsService.create(dto, actor);
  }

  @RequirePermissions(Permission.MEDICAL_RECORD_VIEW)
  @Get('by-appointment/:appointmentId')
  findByAppointment(@Param('appointmentId', ParseUUIDPipe) appointmentId: string) {
    return this.examinationsService.findByAppointment(appointmentId);
  }

  @RequirePermissions(Permission.MEDICAL_RECORD_VIEW)
  @Get(':id/prescriptions')
  listPrescriptions(@Param('id', ParseUUIDPipe) id: string) {
    return this.examinationsService.listPrescriptions(id);
  }

  @RequirePermissions(Permission.MEDICAL_RECORD_CREATE)
  @Post(':id/prescriptions')
  createPrescription(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreatePrescriptionDto) {
    return this.examinationsService.createPrescription(id, dto);
  }

  @RequirePermissions(Permission.MEDICAL_RECORD_CREATE)
  @Post(':id/lab-tests')
  createLabTest(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateLabTestDto) {
    return this.examinationsService.createLabTest(id, dto);
  }

  @RequirePermissions(Permission.MEDICAL_RECORD_UPDATE)
  @Patch('lab-tests/:labTestId')
  updateLabTest(
    @Param('labTestId', ParseUUIDPipe) labTestId: string,
    @Body() dto: UpdateLabTestDto,
  ) {
    return this.examinationsService.updateLabTest(labTestId, dto);
  }

  /** Section 4.1.4: "print/export the exam record and prescription as PDF" - pdfkit only. */
  @RequirePermissions(Permission.MEDICAL_RECORD_VIEW)
  @Get(':id/pdf')
  async exportPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const examination = await this.examinationsService.findOne(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="exam-${id}.pdf"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);
    renderExaminationPdf(doc, examination);
    doc.end();
  }

  @RequirePermissions(Permission.MEDICAL_RECORD_VIEW)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.examinationsService.findOne(id);
  }

  @RequirePermissions(Permission.MEDICAL_RECORD_UPDATE)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateExaminationDto) {
    return this.examinationsService.update(id, dto);
  }
}
