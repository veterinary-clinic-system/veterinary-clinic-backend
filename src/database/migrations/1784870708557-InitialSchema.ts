import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1784870708557 implements MigrationInterface {
  name = 'InitialSchema1784870708557';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "operating_hours" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "branch_id" uuid NOT NULL, "day_of_week" smallint NOT NULL, "open_time" character varying(5) NOT NULL, "close_time" character varying(5) NOT NULL, CONSTRAINT "PK_2ada48e2269e8c902ec3f00439e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_626b99c8462ae44bf9175e8506" ON "operating_hours" ("branch_id", "day_of_week") `,
    );
    await queryRunner.query(
      `CREATE TABLE "branches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "branch_name" character varying(255) NOT NULL, "phone" character varying(20) NOT NULL, "description" text, "address" text NOT NULL, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_7f37d3b42defea97f1df0d19535" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "doctor_shifts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "doctor_id" uuid NOT NULL, "day_of_week" smallint NOT NULL, "start_time" character varying(5) NOT NULL, "end_time" character varying(5) NOT NULL, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_8c0f510d42bb2948addbdd4021b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_61e26b4fa0e3829ab5d4683cc7" ON "doctor_shifts" ("doctor_id", "day_of_week") `,
    );
    await queryRunner.query(
      `CREATE TABLE "doctor_breaks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "doctor_id" uuid NOT NULL, "date" date NOT NULL, "start_time" character varying(5) NOT NULL, "end_time" character varying(5) NOT NULL, "reason" character varying(255), CONSTRAINT "PK_934736d89f5264374d905634157" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e8b49a4dcd3c5888add14a2f5c" ON "doctor_breaks" ("doctor_id", "date") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."doctors_specialization_enum" AS ENUM('GENERAL_PRACTICE', 'INTERNAL_MEDICINE', 'SURGERY', 'THERIOGENOLOGY', 'DERMATOLOGY', 'DENTISTRY', 'DIAGNOSTIC_IMAGING', 'NUTRITION', 'ANESTHESIOLOGY')`,
    );
    await queryRunner.query(
      `CREATE TABLE "doctors" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "branch_id" uuid NOT NULL, "avatar_url" character varying, "active" boolean NOT NULL DEFAULT true, "full_name" character varying(255) NOT NULL, "year_of_start" smallint, "specialization" "public"."doctors_specialization_enum" array NOT NULL DEFAULT '{}', CONSTRAINT "REL_653c27d1b10652eb0c7bbbc442" UNIQUE ("user_id"), CONSTRAINT "PK_8207e7889b50ee3695c2b8154ff" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "species" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "species_name" character varying(100) NOT NULL, CONSTRAINT "UQ_81c196034e3c21812f8eefde6b0" UNIQUE ("species_name"), CONSTRAINT "PK_ae6a87f2423ba6c25dc43c32770" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "breeds" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "species_id" uuid NOT NULL, "breed_name" character varying(100) NOT NULL, CONSTRAINT "PK_e89f6e1fbb29d28623b4feb2b3e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."invoices_payment_method_enum" AS ENUM('CASH', 'E_WALLET', 'CREDIT_CARD')`,
    );
    await queryRunner.query(
      `CREATE TABLE "invoices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "appointment_id" uuid NOT NULL, "payment_method" "public"."invoices_payment_method_enum", "paid" boolean NOT NULL DEFAULT false, "paid_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "REL_70757267b44d3b26bd88966908" UNIQUE ("appointment_id"), CONSTRAINT "PK_668cef7c22a427fd822cc1be3ce" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "invoice_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "invoice_id" uuid NOT NULL, "item_id" uuid NOT NULL, "price" numeric(12,2) NOT NULL, "quantity" integer NOT NULL DEFAULT '1', CONSTRAINT "PK_53b99f9e0e2945e69de1a12b75a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "inventory_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "item_id" uuid NOT NULL, "branch_id" uuid NOT NULL, "inventory_quantity" integer NOT NULL DEFAULT '0', "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_cf2f451407242e132547ac19169" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_3717bc742aedb2402c488114c5" ON "inventory_items" ("item_id", "branch_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."items_itemtype_enum" AS ENUM('SERVICE', 'MEDICATION', 'LAB_TEST', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "item_name" character varying(255) NOT NULL, "describe" text, "itemType" "public"."items_itemtype_enum" NOT NULL DEFAULT 'OTHER', "unit_price" numeric(12,2) NOT NULL DEFAULT '0', "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_ba5885359424c15ca6b9e79bcf6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "services" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "item_id" uuid NOT NULL, "duration_minutes" smallint NOT NULL DEFAULT '30', "requires_specialization" character varying, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "REL_192cb6d659136046ced7f54ac8" UNIQUE ("item_id"), CONSTRAINT "PK_ba2d347a3168a296416c6c5ccb2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."diseases_commonsymptoms_enum" AS ENUM('SKIN_ALLERGY', 'EAR_INFECTION', 'VOMITING', 'DIARRHEA', 'HEMATURIA', 'LOSS_OF_APPETITE', 'WEIGHT_LOSS', 'HYPERACTIVITY')`,
    );
    await queryRunner.query(
      `CREATE TABLE "diseases" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "disease_name" character varying(255) NOT NULL, "commonSymptoms" "public"."diseases_commonsymptoms_enum" array NOT NULL DEFAULT '{}', "other_symptoms" text, CONSTRAINT "UQ_d375b1bc3b014250e4447fe0482" UNIQUE ("disease_name"), CONSTRAINT "PK_79ddc936b1458d8a079b62dc210" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."pre_screening_results_ai_priority_color_enum" AS ENUM('RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "pre_screening_results" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "appointment_id" uuid NOT NULL, "symptom_text" text NOT NULL, "ai_priority_color" "public"."pre_screening_results_ai_priority_color_enum" NOT NULL, "extracted_symptom_keywords" text array NOT NULL DEFAULT '{}', "nlp_confidence" numeric(4,3), "cv_confidence" numeric(4,3), "overall_confidence" numeric(4,3) NOT NULL, "raw_ai_response" jsonb, CONSTRAINT "REL_8847feb0a64995b0fbd5e780ad" UNIQUE ("appointment_id"), CONSTRAINT "PK_0886a3b85111bc67d477af0c9cf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "medications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "item_id" uuid NOT NULL, "unit" character varying(50) NOT NULL, "active_ingredient" character varying(255), "active" boolean NOT NULL DEFAULT true, CONSTRAINT "REL_e29e6cc28d2df49212bf6db26c" UNIQUE ("item_id"), CONSTRAINT "PK_cdee49fe7cd79db13340150d356" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "prescription_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "prescription_id" uuid NOT NULL, "medication_id" uuid NOT NULL, "dosage" character varying(255) NOT NULL, "duration_days" smallint NOT NULL, "instructions" text, CONSTRAINT "PK_6216831f49afc381b3934c9672c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "prescriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "examination_id" uuid NOT NULL, "notes" text, CONSTRAINT "PK_097b2cc2f2b7e56825468188503" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."lab_test_orders_status_enum" AS ENUM('ORDERED', 'IN_PROGRESS', 'COMPLETED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "lab_test_orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "examination_id" uuid NOT NULL, "test_name" character varying(255) NOT NULL, "status" "public"."lab_test_orders_status_enum" NOT NULL DEFAULT 'ORDERED', "result_text" text, "result_file_urls" text array NOT NULL DEFAULT '{}', CONSTRAINT "PK_f6ebdb7503fb8c2ec6422d300fb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "examinations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "appointment_id" uuid NOT NULL, "doctor_id" uuid NOT NULL, "disease_groups" text array NOT NULL DEFAULT '{}', "diagnosis_text" text, "notes" text, "temperature_celsius" numeric(4,1), "weight_kg" numeric(6,2), "heart_rate_bpm" smallint, "respiratory_rate_bpm" smallint, "attachment_urls" text array NOT NULL DEFAULT '{}', "examined_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_480e098f91311e993b64da5835" UNIQUE ("appointment_id"), CONSTRAINT "PK_7694851ac6eaf734b64fcf06c28" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."appointments_status_enum" AS ENUM('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."appointments_priority_color_enum" AS ENUM('RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."appointments_commonsymptoms_enum" AS ENUM('SKIN_ALLERGY', 'EAR_INFECTION', 'VOMITING', 'DIARRHEA', 'HEMATURIA', 'LOSS_OF_APPETITE', 'WEIGHT_LOSS', 'HYPERACTIVITY')`,
    );
    await queryRunner.query(
      `CREATE TABLE "appointments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "doctor_id" uuid NOT NULL, "branch_id" uuid NOT NULL, "pet_id" uuid NOT NULL, "service_id" uuid NOT NULL, "booked_by_user_id" uuid, "start_at" TIMESTAMP WITH TIME ZONE NOT NULL, "end_at" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "public"."appointments_status_enum" NOT NULL DEFAULT 'PENDING', "priority_color" "public"."appointments_priority_color_enum", "photo_urls" text array NOT NULL DEFAULT '{}', "commonSymptoms" "public"."appointments_commonsymptoms_enum" array NOT NULL DEFAULT '{}', "other_symptoms" text, "address" text, "notes" text, "parent_appointment_id" uuid, CONSTRAINT "PK_4a437a9a27e948726b8bb3e36ad" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ec296b83c079eb03d3fa611157" ON "appointments" ("doctor_id", "start_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."pets_gender_enum" AS ENUM('MALE', 'FEMALE', 'HERMAPHRODITE', 'ASEXUAL')`,
    );
    await queryRunner.query(
      `CREATE TABLE "pets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(255) NOT NULL, "breed_id" uuid NOT NULL, "gender" "public"."pets_gender_enum" NOT NULL DEFAULT 'ASEXUAL', "weight" numeric(6,2), "birth_date" date, "avatar_url" character varying, "notes" text, "allergies" text array NOT NULL DEFAULT '{}', "chronic_conditions" text array NOT NULL DEFAULT '{}', "owner_id" uuid NOT NULL, CONSTRAINT "PK_d01e9e7b4ada753c826720bee8b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "token_hash" character varying NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "replaced_by_token_hash" character varying, CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3ddc983c5f7bcf132fd8732c3f" ON "refresh_tokens" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('ADMIN', 'DOCTOR', 'RECEPTIONIST', 'PET_OWNER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "phone" character varying(20) NOT NULL, "email" character varying(255), "full_name" character varying(255) NOT NULL, "password_hash" character varying, "role" "public"."users_role_enum" NOT NULL DEFAULT 'PET_OWNER', "active" boolean NOT NULL DEFAULT true, "branch_id" character varying, CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE ("phone"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_a000cca60bcf04454e72769949" ON "users" ("phone") `);
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('APPOINTMENT_REMINDER', 'APPOINTMENT_UPDATED', 'APPOINTMENT_CANCELLED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_channel_enum" AS ENUM('SMS', 'ZALO')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_status_enum" AS ENUM('PENDING', 'SENT', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "appointment_id" uuid NOT NULL, "type" "public"."notifications_type_enum" NOT NULL, "channel" "public"."notifications_channel_enum" NOT NULL, "recipient_phone" character varying(20) NOT NULL, "message" text NOT NULL, "status" "public"."notifications_status_enum" NOT NULL DEFAULT 'PENDING', "scheduled_for" TIMESTAMP WITH TIME ZONE NOT NULL, "sent_at" TIMESTAMP WITH TIME ZONE, "error_message" text, CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "pre_screening_disease_groups" ("pre_screening_result_id" uuid NOT NULL, "disease_id" uuid NOT NULL, CONSTRAINT "PK_575d35366a5ea8708e7f2c56838" PRIMARY KEY ("pre_screening_result_id", "disease_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2ebac00ca5ff37dc92e615e352" ON "pre_screening_disease_groups" ("pre_screening_result_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_15c0128d789fd6033fda1fa8d7" ON "pre_screening_disease_groups" ("disease_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "operating_hours" ADD CONSTRAINT "FK_f001135bad68e9b53b0299ed364" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctor_shifts" ADD CONSTRAINT "FK_a4a795dca2ff99a71ef436bbb5d" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctor_breaks" ADD CONSTRAINT "FK_46c908f756ddb7f78088d7c9e30" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctors" ADD CONSTRAINT "FK_653c27d1b10652eb0c7bbbc4427" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctors" ADD CONSTRAINT "FK_efbb5ff2cfbc55ca8f22d1006d8" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "breeds" ADD CONSTRAINT "FK_0ea3bf7a9569bb26556fb5a7fb2" FOREIGN KEY ("species_id") REFERENCES "species"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_70757267b44d3b26bd88966908b" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_items" ADD CONSTRAINT "FK_dc991d555664682cfe892eea2c1" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_items" ADD CONSTRAINT "FK_f0b6dca088c1c2d694e91d42aab" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_items" ADD CONSTRAINT "FK_6c06346f7daad6d05f3cdb95026" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_items" ADD CONSTRAINT "FK_687d174ee41f46d2ee4b0a241ae" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" ADD CONSTRAINT "FK_192cb6d659136046ced7f54ac8b" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_screening_results" ADD CONSTRAINT "FK_8847feb0a64995b0fbd5e780ad4" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "medications" ADD CONSTRAINT "FK_e29e6cc28d2df49212bf6db26c7" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "prescription_items" ADD CONSTRAINT "FK_a603d92d4a8459db5fbe45a4aea" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "prescription_items" ADD CONSTRAINT "FK_dcb2e6ee4fcd4f07516ea88758d" FOREIGN KEY ("medication_id") REFERENCES "medications"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "prescriptions" ADD CONSTRAINT "FK_132ec5a26296f40be685f079554" FOREIGN KEY ("examination_id") REFERENCES "examinations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lab_test_orders" ADD CONSTRAINT "FK_9d4aa2090a5a999bbca0d430a4f" FOREIGN KEY ("examination_id") REFERENCES "examinations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "examinations" ADD CONSTRAINT "FK_480e098f91311e993b64da5835b" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "examinations" ADD CONSTRAINT "FK_9d06e775e6214959a566b4ea465" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "FK_4cf26c3f972d014df5c68d503d2" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "FK_fc5d925c8972ba27457e23e7c09" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "FK_47439f4739409e7e27f2e5444d5" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "FK_2a2088e8eaa8f28d8de2bdbb857" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "FK_02cbc216c57a5e6faff8ca8f46f" FOREIGN KEY ("booked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" ADD CONSTRAINT "FK_33bed51c16e5a48fe204774beaa" FOREIGN KEY ("parent_appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pets" ADD CONSTRAINT "FK_478d65b6063e614271e7d4bebad" FOREIGN KEY ("breed_id") REFERENCES "breeds"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pets" ADD CONSTRAINT "FK_d6c565fded8031d4cdd54fe1043" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_9e2d01428faefb60e63c287c04a" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_screening_disease_groups" ADD CONSTRAINT "FK_2ebac00ca5ff37dc92e615e3526" FOREIGN KEY ("pre_screening_result_id") REFERENCES "pre_screening_results"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_screening_disease_groups" ADD CONSTRAINT "FK_15c0128d789fd6033fda1fa8d71" FOREIGN KEY ("disease_id") REFERENCES "diseases"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pre_screening_disease_groups" DROP CONSTRAINT "FK_15c0128d789fd6033fda1fa8d71"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_screening_disease_groups" DROP CONSTRAINT "FK_2ebac00ca5ff37dc92e615e3526"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_9e2d01428faefb60e63c287c04a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"`,
    );
    await queryRunner.query(`ALTER TABLE "pets" DROP CONSTRAINT "FK_d6c565fded8031d4cdd54fe1043"`);
    await queryRunner.query(`ALTER TABLE "pets" DROP CONSTRAINT "FK_478d65b6063e614271e7d4bebad"`);
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT "FK_33bed51c16e5a48fe204774beaa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT "FK_02cbc216c57a5e6faff8ca8f46f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT "FK_2a2088e8eaa8f28d8de2bdbb857"`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT "FK_47439f4739409e7e27f2e5444d5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT "FK_fc5d925c8972ba27457e23e7c09"`,
    );
    await queryRunner.query(
      `ALTER TABLE "appointments" DROP CONSTRAINT "FK_4cf26c3f972d014df5c68d503d2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "examinations" DROP CONSTRAINT "FK_9d06e775e6214959a566b4ea465"`,
    );
    await queryRunner.query(
      `ALTER TABLE "examinations" DROP CONSTRAINT "FK_480e098f91311e993b64da5835b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lab_test_orders" DROP CONSTRAINT "FK_9d4aa2090a5a999bbca0d430a4f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prescriptions" DROP CONSTRAINT "FK_132ec5a26296f40be685f079554"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prescription_items" DROP CONSTRAINT "FK_dcb2e6ee4fcd4f07516ea88758d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "prescription_items" DROP CONSTRAINT "FK_a603d92d4a8459db5fbe45a4aea"`,
    );
    await queryRunner.query(
      `ALTER TABLE "medications" DROP CONSTRAINT "FK_e29e6cc28d2df49212bf6db26c7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pre_screening_results" DROP CONSTRAINT "FK_8847feb0a64995b0fbd5e780ad4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "services" DROP CONSTRAINT "FK_192cb6d659136046ced7f54ac8b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_items" DROP CONSTRAINT "FK_687d174ee41f46d2ee4b0a241ae"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_items" DROP CONSTRAINT "FK_6c06346f7daad6d05f3cdb95026"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_items" DROP CONSTRAINT "FK_f0b6dca088c1c2d694e91d42aab"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_items" DROP CONSTRAINT "FK_dc991d555664682cfe892eea2c1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_70757267b44d3b26bd88966908b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "breeds" DROP CONSTRAINT "FK_0ea3bf7a9569bb26556fb5a7fb2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctors" DROP CONSTRAINT "FK_efbb5ff2cfbc55ca8f22d1006d8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctors" DROP CONSTRAINT "FK_653c27d1b10652eb0c7bbbc4427"`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctor_breaks" DROP CONSTRAINT "FK_46c908f756ddb7f78088d7c9e30"`,
    );
    await queryRunner.query(
      `ALTER TABLE "doctor_shifts" DROP CONSTRAINT "FK_a4a795dca2ff99a71ef436bbb5d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "operating_hours" DROP CONSTRAINT "FK_f001135bad68e9b53b0299ed364"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_15c0128d789fd6033fda1fa8d7"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2ebac00ca5ff37dc92e615e352"`);
    await queryRunner.query(`DROP TABLE "pre_screening_disease_groups"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_channel_enum"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a000cca60bcf04454e72769949"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3ddc983c5f7bcf132fd8732c3f"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "pets"`);
    await queryRunner.query(`DROP TYPE "public"."pets_gender_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ec296b83c079eb03d3fa611157"`);
    await queryRunner.query(`DROP TABLE "appointments"`);
    await queryRunner.query(`DROP TYPE "public"."appointments_commonsymptoms_enum"`);
    await queryRunner.query(`DROP TYPE "public"."appointments_priority_color_enum"`);
    await queryRunner.query(`DROP TYPE "public"."appointments_status_enum"`);
    await queryRunner.query(`DROP TABLE "examinations"`);
    await queryRunner.query(`DROP TABLE "lab_test_orders"`);
    await queryRunner.query(`DROP TYPE "public"."lab_test_orders_status_enum"`);
    await queryRunner.query(`DROP TABLE "prescriptions"`);
    await queryRunner.query(`DROP TABLE "prescription_items"`);
    await queryRunner.query(`DROP TABLE "medications"`);
    await queryRunner.query(`DROP TABLE "pre_screening_results"`);
    await queryRunner.query(`DROP TYPE "public"."pre_screening_results_ai_priority_color_enum"`);
    await queryRunner.query(`DROP TABLE "diseases"`);
    await queryRunner.query(`DROP TYPE "public"."diseases_commonsymptoms_enum"`);
    await queryRunner.query(`DROP TABLE "services"`);
    await queryRunner.query(`DROP TABLE "items"`);
    await queryRunner.query(`DROP TYPE "public"."items_itemtype_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_3717bc742aedb2402c488114c5"`);
    await queryRunner.query(`DROP TABLE "inventory_items"`);
    await queryRunner.query(`DROP TABLE "invoice_items"`);
    await queryRunner.query(`DROP TABLE "invoices"`);
    await queryRunner.query(`DROP TYPE "public"."invoices_payment_method_enum"`);
    await queryRunner.query(`DROP TABLE "breeds"`);
    await queryRunner.query(`DROP TABLE "species"`);
    await queryRunner.query(`DROP TABLE "doctors"`);
    await queryRunner.query(`DROP TYPE "public"."doctors_specialization_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_e8b49a4dcd3c5888add14a2f5c"`);
    await queryRunner.query(`DROP TABLE "doctor_breaks"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_61e26b4fa0e3829ab5d4683cc7"`);
    await queryRunner.query(`DROP TABLE "doctor_shifts"`);
    await queryRunner.query(`DROP TABLE "branches"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_626b99c8462ae44bf9175e8506"`);
    await queryRunner.query(`DROP TABLE "operating_hours"`);
  }
}
