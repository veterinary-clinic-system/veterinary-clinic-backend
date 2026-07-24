import { Specialization } from '@/common/enums/specialization.enum';

/**
 * `GET /users/doctors` and `GET /users/doctors/:id` are `@Public()` (marketing site +
 * booking flow's doctor picker), so the response must never leak anything from the
 * linked `User` row (phone, email) or admin-only fields - only what a site visitor is
 * allowed to see. `UsersService` maps every `Doctor` entity through this shape before
 * it leaves the service, rather than relying on serialization interceptors to strip
 * fields after the fact.
 */
export class PublicDoctorBranchDto {
  id: string;
  branchName: string;
}

export class PublicDoctorDto {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  yearOfStart: number | null;
  specialization: Specialization[];
  branch: PublicDoctorBranchDto | null;
}
