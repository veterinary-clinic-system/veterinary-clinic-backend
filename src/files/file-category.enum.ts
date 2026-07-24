/** Sub-folder under FILE_STORAGE_ROOT each upload category is written to. */
export enum FileCategory {
  PET_AVATAR = 'pet-avatars',
  DOCTOR_AVATAR = 'doctor-avatars',
  SYMPTOM_PHOTO = 'symptom-photos',
  EXAM_ATTACHMENT = 'exam-attachments',
  LAB_RESULT = 'lab-results',
}

export const IMAGE_CATEGORIES: FileCategory[] = [
  FileCategory.PET_AVATAR,
  FileCategory.DOCTOR_AVATAR,
  FileCategory.SYMPTOM_PHOTO,
];
