import type { Order } from '../types';

// Accept labels from carts saved before canonical IDs were used in the modal.
export function normalizeMeatPoint(value?: string) {
  return value?.trim().toLowerCase().replace(/\s+/g, '-');
}

export function buildOrderRequest(order: Omit<Order,'id'|'orderNumber'|'createdAt'|'updatedAt'>) {
  return {
    customerName:order.customerName,customerPhone:order.customerPhone,
    deliveryAddress:order.deliveryAddress,paymentMethod:order.paymentMethod,
    paymentChange:order.paymentChange,notes:order.notes,couponCode:order.couponCode,
    items:order.items.map(item=>({productId:item.productId,quantity:item.quantity,
      notes:item.notes,meatPoint:normalizeMeatPoint(item.meatPoint),removals:item.removals,
      selectedAddons:item.selectedAddons?.map(addon=>({id:addon.id}))})),
  };
}
