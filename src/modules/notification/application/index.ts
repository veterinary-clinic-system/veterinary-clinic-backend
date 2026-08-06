/**
 * API cong khai cua bounded context `notification`.
 *
 * Module khac CHI duoc import tu day (hoac tu `domain/entities`), khong duoc voi tay
 * vao `infrastructure/` hay `presentation/` - quy tac Phan III tai lieu kien truc,
 * duoc ESLint `import/no-restricted-paths` chan cung.
 *
 * Giu barrel nay hep co chu dich: no chinh la "be mat" se tro thanh hop dong HTTP
 * neu sau nay tach notification thanh service rieng.
 */
export { NotificationsService } from './notifications.service';
export { OutboxService } from './outbox.service';
export type { RecordOutboxEventParams } from './outbox.service';
export { StaffNotificationsService } from './staff-notifications.service';
export type { NotifyStaffParams } from './staff-notifications.service';
