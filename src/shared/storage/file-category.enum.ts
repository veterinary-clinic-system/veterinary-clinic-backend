export enum FileCategory {
  PET_AVATAR = 'pet-avatars',
  DOCTOR_AVATAR = 'doctor-avatars',
  USER_AVATAR = 'user-avatars',
  EMPLOYEE_AVATAR = 'employee-avatars',
  CATALOG_IMAGE = 'catalog-images',
  SYMPTOM_PHOTO = 'symptom-photos',
  SYMPTOM_VIDEO = 'symptom-videos',
  EXAM_ATTACHMENT = 'exam-attachments',
  LAB_RESULT = 'lab-results',
}

export const IMAGE_CATEGORIES: FileCategory[] = [
  FileCategory.PET_AVATAR,
  FileCategory.DOCTOR_AVATAR,
  FileCategory.USER_AVATAR,
  FileCategory.EMPLOYEE_AVATAR,
  FileCategory.CATALOG_IMAGE,
  FileCategory.SYMPTOM_PHOTO,
];
