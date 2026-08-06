/**
 * API cong khai cua bounded context `clinical` (kham benh, ho so benh an, don thuoc,
 * xet nghiem).
 *
 * Module khac CHI duoc import tu day (hoac tu `domain/entities`) - ESLint
 * `import/no-restricted-paths` chan cung moi duong khac. Xem ghi chu trong
 * `modules/triage/application/index.ts`.
 */
export { ExaminationsService } from './examinations.service';
export { MedicalRecordsService } from './medical-records.service';
export { PrescriptionsService } from './prescriptions.service';
export type { PrescriptionItemStock, PrescriptionView } from './prescriptions.service';
export { VaccinationsService } from './vaccinations.service';
export type { VaccinationDueRow, VaccinationRecordView } from './vaccinations.service';
export { VaccinationReminderService } from './vaccination-reminder.service';
export { LaboratoriesService } from './laboratories.service';
export type { LabQueueRow, LabTrendPoint, LabTrendSeries } from './laboratories.service';
