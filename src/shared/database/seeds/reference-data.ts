import { cloudinaryWebImage } from '@/shared/storage/cloudinary-web-assets';

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

export const DOCTOR_AVATAR_FILES = [1, 2, 3, 4, 5, 6].map((index) =>
  cloudinaryWebImage(`doctors/doctor-${index}.svg`),
);
