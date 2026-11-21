import {
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags } from '@nestjs/swagger';
import { Appointment } from '@/modules/scheduling/domain/entities/appointment.entity';
import { RequirePermissions } from '@/shared/common/decorators/require-permissions.decorator';
import { Permission } from '@/shared/common/enums/permission.enum';
import { PrescreeningService } from '@/modules/triage/application/prescreening.service';
import { TERMINAL_APPOINTMENT_STATUSES } from '@/shared/common/enums/appointment-status.enum';

@ApiTags('prescreening')
@Controller('appointments/:appointmentId/prescreening')
@RequirePermissions(Permission.APPOINTMENT_VIEW)
export class PrescreeningController {
  constructor(
    private readonly prescreeningService: PrescreeningService,
    @InjectRepository(Appointment)
    private readonly appointmentsRepository: Repository<Appointment>,
  ) {}

  /** Chưa chạy sàng lọc thì trả 200 với `null` - không phải lỗi, không để client thấy 404. */
  @Get()
  findResult(@Param('appointmentId', ParseUUIDPipe) appointmentId: string) {
    return this.prescreeningService.findByAppointmentOrNull(appointmentId);
  }

  @Post('run')
  async run(@Param('appointmentId', ParseUUIDPipe) appointmentId: string) {
    const appointment = await this.appointmentsRepository.findOne({
      where: { id: appointmentId },
      relations: ['pet', 'pet.breed', 'pet.breed.species'],
    });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    // Lịch đã kết thúc (huỷ, không đến, đã khám xong) là hồ sơ lịch sử: chạy lại AI sẽ ghi đè
    // mức ưu tiên đã dùng lúc tiếp nhận.
    if (TERMINAL_APPOINTMENT_STATUSES.has(appointment.status)) {
      throw new ConflictException(
        'Lịch hẹn đã kết thúc (đã hủy, khách không đến hoặc đã khám xong) - không thể chạy lại phân tích AI.',
      );
    }
    return this.prescreeningService.runForAppointment(appointment, appointment.pet);
  }
}
