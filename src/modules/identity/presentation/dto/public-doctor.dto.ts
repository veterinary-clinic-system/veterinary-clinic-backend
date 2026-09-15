import { Specialization } from '@/shared/common/enums/specialization.enum';

export class PublicDoctorBranchDto {
  id: string;
  branchName: string;
}

export class PublicDoctorDto {
  id: string;
  fullName: string;
  avatarUrl: string;
  yearOfStart: number | null;
  specialization: Specialization[];
  branch: PublicDoctorBranchDto | null;
}
