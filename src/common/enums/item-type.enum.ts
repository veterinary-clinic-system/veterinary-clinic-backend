/**
 * Not in diagram.jpg - `Item` there is a generic priced/stocked "thing" referenced by
 * both InvoiceItem and InventoryItem. We tag it with a kind so billing/reporting code
 * doesn't need an outer join to Service/Medication to know what a line item represents.
 */
export enum ItemType {
  SERVICE = 'SERVICE',
  MEDICATION = 'MEDICATION',
  LAB_TEST = 'LAB_TEST',
  OTHER = 'OTHER',
}
