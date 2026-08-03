import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags } from '@nestjs/swagger';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { Roles } from '@/shared/common/decorators/roles.decorator';
import { Role } from '@/shared/common/enums/role.enum';
import { PrescreeningService } from '@/modules/triage/application/prescreening.service';

@ApiTags('prescreening')
@Controller('appointments/:appointmentId/prescreening')
@Roles(Role.ADMIN, Role.RECEPTIONIST, Role.DOCTOR)
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
