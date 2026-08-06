/**
 * Not in diagram.jpg - `Item` there is a generic priced/stocked "thing" referenced by
 * both InvoiceItem and InventoryItem. We tag it with a kind so billing/reporting code
 * doesn't need an outer join to Service/Medication to know what a line item represents.
 */
export enum ItemType {
  SERVICE = 'SERVICE',
  MEDICATION = 'MEDICATION',
  LAB_TEST = 'LAB_TEST',
  /**
   * Hang hoa ban le - SRS FR-16 (P5). Product gan vao `items` giong het Service va
   * Medication thay vi dung mot bang gia song song: neu `products` co cot gia rieng
   * thi POS va Invoice phai xu ly hai nguon gia, va moi bao cao doanh thu phai UNION.
   */
  PRODUCT = 'PRODUCT',
  /**
   * Vaccine - SRS FR-12 (P9). Cung ly do voi PRODUCT: vaccine co gia, ban duoc, nam
   * trong kho co lo va han dung, nen no phai la mot `Item` chu khong phai mot bang
   * song song. Tach khoi MEDICATION vi hai thu duoc CHON o hai cho khac nhau va theo
   * hai tieu chi khac nhau - thuoc chon theo hoat chat, vaccine chon theo benh phong
   * ngua va loai duoc tiem.
   */
  VACCINE = 'VACCINE',
  OTHER = 'OTHER',
}
