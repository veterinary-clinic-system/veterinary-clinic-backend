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
  OTHER = 'OTHER',
}
