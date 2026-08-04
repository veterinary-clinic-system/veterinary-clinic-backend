import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags } from '@nestjs/swagger';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { PrescreeningService } from '@/modules/triage/application/prescreening.service';

/**
 * Tien chan doan AI la phan MO RONG ngoai SRS, gan chat voi lich hen nen dung chung
 * quyen `APPOINTMENT_VIEW` thay vi mo them mot nhom quyen rieng.
 */
@ApiTags('prescreening')
@Controller('appointments/:appointmentId/prescreening')
@RequirePermissions(Permission.APPOINTMENT_VIEW)
export class PrescreeningController {
  constructor(
    private readonly prescreeningService: PrescreeningService,
    @InjectRepository(Appointment)
    private readonly appointmentsRepository: Repository<Appointment>,
  ) {}

  @Get()
  findResult(@Param('appointmentId', ParseUUIDPipe) appointmentId: string) {
    return this.prescreeningService.findByAppointment(appointmentId);
  }

  /** Re-runs the AI pipeline, e.g. after the receptionist adds late-arriving symptom photos. */
  @Post('run')
  async run(@Param('appointmentId', ParseUUIDPipe) appointmentId: string) {
    const appointment = await this.appointmentsRepository.findOne({
      where: { id: appointmentId },
      relations: ['pet', 'pet.breed', 'pet.breed.species'],
    });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    return this.prescreeningService.runForAppointment(appointment, appointment.pet);
  }
}
