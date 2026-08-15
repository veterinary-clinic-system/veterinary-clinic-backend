/**
 * Danh muc loai va giong thu cung dung chung cho ca hai script seed.
 *
 * Tach ra file rieng vi `run-seed.ts` (CSDL trong) va `top-up-reference-data.ts` (CSDL
 * dang chay) deu can dung mot danh sach. Nhan doi no sang hai cho la hai cho phai nho
 * sua moi lan phong kham bo sung mot giong moi - va sau vai lan chung se lech nhau.
 *
 * Moi loai co mot muc "Giong khac / chua xac dinh": phan lon thu cung tai Viet Nam la
 * giong lai, va bat le tan chon mot giong sai con te hon la de ho chon "chua xac dinh".
 */
export interface SpeciesCatalogEntry {
  name: string;
  breeds: string[];
}

export const SPECIES_CATALOG: SpeciesCatalogEntry[] = [
  {
    name: 'Chó',
    breeds: [
      'Chó cỏ (Chó ta)',
      'Chó Phú Quốc',
      'Chó H’Mông cộc đuôi',
      'Poodle',
      'Corgi',
      'Golden Retriever',
      'Labrador Retriever',
      'Alaskan Malamute',
      'Husky Siberian',
      'Chihuahua',
      'Pug',
      'Shiba Inu',
      'Phốc sóc (Pomeranian)',
      'Becgie Đức (German Shepherd)',
      'Rottweiler',
      'Dachshund (Lạp xưởng)',
      'Bull Pháp (French Bulldog)',
      'Beagle',
      'Border Collie',
      'Samoyed',
      'Chow Chow',
      'Cocker Spaniel',
      'Bắc Kinh (Pekingese)',
      'Giống khác / chưa xác định',
    ],
  },
  {
    name: 'Mèo',
    breeds: [
      'Mèo ta (mèo cỏ)',
      'Mèo mướp',
      'British Shorthair',
      'Mèo Ba Tư (Persian)',
      'Mèo Anh lông dài',
      'Scottish Fold',
      'Munchkin (chân ngắn)',
      'Maine Coon',
      'Bengal',
      'Ragdoll',
      'Sphynx (không lông)',
      'Xiêm (Siamese)',
      'Mèo Nga mắt xanh (Russian Blue)',
      'American Shorthair',
      'Mèo tam thể',
      'Giống khác / chưa xác định',
    ],
  },
  {
    name: 'Chim cảnh',
    breeds: [
      'Vẹt Yến Phụng (Budgie)',
      'Vẹt Cockatiel',
      'Vẹt Lovebird',
      'Chào mào',
      'Yến hót (Canary)',
      'Bồ câu',
      'Sáo',
      'Giống khác / chưa xác định',
    ],
  },
  {
    name: 'Thỏ',
    breeds: [
      'Thỏ ta',
      'Thỏ New Zealand',
      'Thỏ Hà Lan (Dutch)',
      'Thỏ Lop tai cụp',
      'Thỏ Rex',
      'Thỏ Angora',
      'Giống khác / chưa xác định',
    ],
  },
  {
    name: 'Hamster & gặm nhấm nhỏ',
    breeds: [
      'Hamster Bear',
      'Hamster Winter White',
      'Hamster Robo',
      'Chuột lang (Guinea Pig)',
      'Sóc bay Úc (Sugar Glider)',
      'Nhím kiểng',
      'Chinchilla',
      'Giống khác / chưa xác định',
    ],
  },
  {
    name: 'Bò sát & lưỡng cư',
    breeds: [
      'Rùa cạn',
      'Rùa tai đỏ',
      'Rồng Nam Mỹ (Iguana)',
      'Rồng Úc (Bearded Dragon)',
      'Tắc kè hoa',
      'Trăn cảnh',
      'Kỳ tôm / Kỳ đà',
      'Giống khác / chưa xác định',
    ],
  },
  {
    name: 'Cá cảnh',
    breeds: ['Cá Koi', 'Cá vàng', 'Cá Betta (cá xiêm)', 'Cá rồng', 'Giống khác / chưa xác định'],
  },
];

/**
 * Anh MINH HOA cua bac si (hinh ve phang, khong phai nguoi that) nam trong
 * `veterinary-clinic-web/public/doctors/`. Xem README o thu muc do de biet cach thay
 * bang anh chan dung that cua phong kham.
 */
export const DOCTOR_AVATAR_FILES = [
  '/doctors/doctor-1.svg',
  '/doctors/doctor-2.svg',
  '/doctors/doctor-3.svg',
  '/doctors/doctor-4.svg',
  '/doctors/doctor-5.svg',
  '/doctors/doctor-6.svg',
];
