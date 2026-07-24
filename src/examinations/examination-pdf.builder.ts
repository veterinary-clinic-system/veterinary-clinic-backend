import PDFDocument from 'pdfkit';
import { Examination } from '@/database/entities';

/**
 * Section 4.1.4: "print/export the exam record and prescription as PDF". pdfkit-only
 * (no HTML-to-PDF/browser dependency) - draws directly onto a document the caller
 * already created and will `.pipe()`/`.end()` themselves (see ExaminationsController).
 * `examination` must be loaded with EXAMINATION_DETAIL_RELATIONS (see
 * examinations.service.ts) so appointment/pet/owner/doctor/prescriptions/labTestOrders
 * are all populated.
 */
export function renderExaminationPdf(
  doc: InstanceType<typeof PDFDocument>,
  examination: Examination,
): void {
  const appointment = examination.appointment;
  const pet = appointment?.pet;
  const owner = pet?.owner;
  const branch = appointment?.branch;
  // The doctor who actually wrote up the exam (current user at creation time) is the
  // authoritative signature; fall back to the appointment's assigned doctor if absent.
  const doctor = examination.doctor ?? appointment?.doctor;

  doc.fontSize(18).text(branch?.branchName ?? 'Veterinary Clinic', { align: 'center' });
  doc.fontSize(10).text('EXAMINATION RECORD & PRESCRIPTION', { align: 'center' });
  if (branch?.address) {
    doc.fontSize(9).fillColor('gray').text(branch.address, { align: 'center' });
  }
  doc.fillColor('black');
  doc.moveDown(1.5);

  doc.fontSize(11);
  doc.text(`Pet: ${pet?.name ?? '-'}`);
  doc.text(
    `Species: ${pet?.breed?.species?.speciesName ?? '-'}    Breed: ${pet?.breed?.breedName ?? '-'}`,
  );
  doc.text(`Owner: ${owner?.fullName ?? '-'}    Phone: ${owner?.phone ?? '-'}`);
  doc.text(`Exam date: ${new Date(examination.examinedAt).toLocaleString('en-GB')}`);
  doc.moveDown();

  doc.fontSize(13).text('Vital signs', { underline: true });
  doc.fontSize(11);
  doc.text(
    `Temperature: ${examination.temperatureCelsius ?? '-'} °C     Weight: ${examination.weightKg ?? '-'} kg`,
  );
  doc.text(
    `Heart rate: ${examination.heartRateBpm ?? '-'} bpm     Respiratory rate: ${examination.respiratoryRateBpm ?? '-'} bpm`,
  );
  doc.moveDown();

  doc.fontSize(13).text('Diagnosis', { underline: true });
  doc.fontSize(11).text(examination.diagnosisText || '-');
  if (examination.diseaseGroups?.length) {
    doc.text(`Disease group(s): ${examination.diseaseGroups.join(', ')}`);
  }
  doc.moveDown();

  if (examination.notes) {
    doc.fontSize(13).text('Doctor notes', { underline: true });
    doc.fontSize(11).text(examination.notes);
    doc.moveDown();
  }

  const prescriptionItems = (examination.prescriptions ?? []).flatMap((p) => p.items ?? []);
  doc.fontSize(13).text('Prescribed medications', { underline: true });
  doc.fontSize(11);
  if (prescriptionItems.length === 0) {
    doc.text('None');
  } else {
    prescriptionItems.forEach((item, index) => {
      const name = item.medication?.item?.itemName ?? 'Medication';
      const unit = item.medication?.unit ? ` ${item.medication.unit}` : '';
      let line = `${index + 1}. ${name} - Dosage: ${item.dosage}${unit}, Duration: ${item.durationDays} day(s)`;
      if (item.instructions) {
        line += `, Instructions: ${item.instructions}`;
      }
      doc.text(line);
    });
  }
  doc.moveDown();

  doc.fontSize(13).text('Lab tests', { underline: true });
  doc.fontSize(11);
  if (!examination.labTestOrders || examination.labTestOrders.length === 0) {
    doc.text('None');
  } else {
    examination.labTestOrders.forEach((test, index) => {
      let line = `${index + 1}. ${test.testName} - Status: ${test.status}`;
      if (test.resultText) {
        line += `, Result: ${test.resultText}`;
      }
      doc.text(line);
    });
  }

  doc.moveDown(3);
  doc.fontSize(11).text('_______________________________', { align: 'right' });
  doc.text(`Dr. ${doctor?.fullName ?? '-'}`, { align: 'right' });
}
