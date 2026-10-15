export { AppointmentsService } from './appointments.service';
export { AvailabilityService, SlotStatus, slotsCovering } from './availability.service';
export type { DayAvailability, SlotInfo } from './availability.service';
export {
  SELF_BOOKING_TOO_SOON_MESSAGE,
  earliestSelfBookableStart,
} from '@/modules/scheduling/domain/booking-window';
export type { CreateBookingDto } from '@/modules/scheduling/presentation/dto/create-booking.dto';
