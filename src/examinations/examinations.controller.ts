import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Role } from '@/common/enums/role.enum';
import { AuthenticatedUser } from '@/common/interfaces/authenticated-user.interface';
import { ExaminationsService } from './examinations.service';
import { CreateExaminationDto } from './dto/create-examination.dto';
import { UpdateExaminationDto } from './dto/update-examination.dto';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { CreateLabTestDto } from './dto/create-lab-test.dto';
import { UpdateLabTestDto } from './dto/update-lab-test.dto';
import { renderExaminationPdf } from './examination-pdf.builder';

@ApiTags('examinations')
@Controller('examinations')
export class ExaminationsController {
  constructor(private readonly examinationsService: ExaminationsService) {}

  @Roles(Role.DOCTOR)
  @Post()
  create(@Body() dto: CreateExaminationDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.examinationsService.create(dto, actor);
  }

  @Roles(Role.DOCTOR, Role.RECEPTIONIST, Role.ADMIN)
  @Get('by-appointment/:appointmentId')
  findByAppointment(@Param('appointmentId', ParseUUIDPipe) appointmentId: string) {
    return this.examinationsService.findByAppointment(appointmentId);
  }

  @Roles(Role.DOCTOR, Role.RECEPTIONIST, Role.ADMIN)
  @Get(':id/prescriptions')
  listPrescriptions(@Param('id', ParseUUIDPipe) id: string) {
    return this.examinationsService.listPrescriptions(id);
  }

  @Roles(Role.DOCTOR)
  @Post(':id/prescriptions')
  createPrescription(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreatePrescriptionDto) {
    return this.examinationsService.createPrescription(id, dto);
  }

  @Roles(Role.DOCTOR)
  @Post(':id/lab-tests')
  createLabTest(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateLabTestDto) {
    return this.examinationsService.createLabTest(id, dto);
  }

  @Roles(Role.DOCTOR)
  @Patch('lab-tests/:labTestId')
  updateLabTest(
    @Param('labTestId', ParseUUIDPipe) labTestId: string,
    @Body() dto: UpdateLabTestDto,
  ) {
    return this.examinationsService.updateLabTest(labTestId, dto);
  }

  /** Section 4.1.4: "print/export the exam record and prescription as PDF" - pdfkit only. */
  @Roles(Role.DOCTOR, Role.RECEPTIONIST, Role.ADMIN)
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

  @Roles(Role.DOCTOR, Role.RECEPTIONIST, Role.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.examinationsService.findOne(id);
  }

  @Roles(Role.DOCTOR)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateExaminationDto) {
    return this.examinationsService.update(id, dto);
  }
}
