import { ForbiddenException } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';

describe('AppointmentsController public checkout', () => {
  const appointment = {
    id: 'appointment-id',
    pet: { owner: { phone: '0912345678' } },
  };
  const invoice = { id: 'invoice-id' };
  const ticket = { paymentId: 'payment-id' };

  function createController() {
    const appointmentsService = { findOne: jest.fn().mockResolvedValue(appointment) };
    const billingService = { generateForAppointment: jest.fn().mockResolvedValue(invoice) };
    const sepayService = { createQrTicket: jest.fn().mockResolvedValue(ticket) };
    const controller = new AppointmentsController(
      appointmentsService as never,
      {} as never,
      billingService as never,
      sepayService as never,
    );
    return { controller, billingService, sepayService };
  }

  it('creates the service invoice and QR ticket when the booking phone matches', async () => {
    const { controller, billingService, sepayService } = createController();

    await expect(
      controller.createPublicBookingCheckout('appointment-id', { phone: '+84912345678' }),
    ).resolves.toBe(ticket);
    expect(billingService.generateForAppointment).toHaveBeenCalledWith('appointment-id');
    expect(sepayService.createQrTicket).toHaveBeenCalledWith('invoice-id');
  });

  it('rejects checkout when the booking phone does not match', async () => {
    const { controller, billingService, sepayService } = createController();

    await expect(
      controller.createPublicBookingCheckout('appointment-id', { phone: '0987654321' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(billingService.generateForAppointment).not.toHaveBeenCalled();
    expect(sepayService.createQrTicket).not.toHaveBeenCalled();
  });
});
