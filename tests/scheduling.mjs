import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOrderReadyForAttention, isWaitingScheduledOrder, pendingOrderQueue, selectOrders, newUnseenOrderIds, orderCounts, orderStageFromUrl, formatOrderAddress } from '../src/utils/adminOrders.ts';
import { parseScheduleOptions, formatScheduledTime } from '../src/utils/scheduling.ts';
import { buildOrderRequest } from '../src/utils/checkout.ts';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OrderReceiptModal } from '../src/components/admin/OrderReceiptModal.tsx';

const now = Date.parse('2026-10-25T23:45:00-03:00');
const order = { id:'scheduled', status:'recebido', orderNumber:1, customerName:'Teste', customerPhone:'51999999999', items:[], createdAt:'2026-10-25T19:00:00-03:00', scheduledFor:'2026-10-26T00:30:00-03:00', preparationMinutes:30 };
test('future schedules stay out of queue, overview, counts and notifications until preparation window', () => {
  assert.equal(isWaitingScheduledOrder(order, now), true);
  assert.equal(pendingOrderQueue([order], now).length, 0);
  assert.equal(selectOrders([order], 'todos', '', now).length, 0);
  assert.equal(orderCounts([order], now).recebido, 0);
  assert.deepEqual(newUnseenOrderIds([order], new Set(), now), []);
  assert.deepEqual(selectOrders([order], 'agendados', '', now), [order]);
});
test('crossing midnight moves schedule to queue without mutating status or sending acceptance', () => {
  const ready = Date.parse('2026-10-26T00:00:00-03:00');
  assert.equal(isOrderReadyForAttention(order, ready - 1), false);
  assert.equal(isOrderReadyForAttention(order, ready), true);
  assert.deepEqual(pendingOrderQueue([order], ready), [order]);
  assert.equal(selectOrders([order], 'agendados', '', ready).length, 0);
  assert.equal(order.status, 'recebido');
});
test('cancelled schedules remain in cancelled area; malformed dates cannot advance', () => {
  assert.equal(isWaitingScheduledOrder({...order,status:'cancelado'}, now), false);
  assert.equal(selectOrders([{...order,status:'cancelado'}], 'cancelado', '', now).length, 1);
  assert.equal(isOrderReadyForAttention({...order,scheduledFor:'invalid'}, now), false);
  assert.equal(isOrderReadyForAttention({...order,scheduledFor:undefined}, now), true);
});
test('scheduled stage persists in URL; pickup contact and scheduled time display accurately', () => {
  assert.equal(orderStageFromUrl('http://localhost/?etapa=agendados#/admdono'), 'agendados');
  assert.equal(formatOrderAddress({...order,fulfillmentMode:'pickup'}), 'Retirada na loja');
  assert.match(formatScheduledTime(order.scheduledFor), /26\/10/);
  assert.match(formatScheduledTime(order.scheduledFor), /00:30/);
});
test('only a complete server contract enables scheduling; missing, denied and malformed data fail closed', () => {
  const valid={enabled:true,server_now:new Date(now).toISOString(),slots:[order.scheduledFor],preparation_minutes:30,fulfillment_modes:['delivery','pickup']};
  assert.ok(parseScheduleOptions(valid));
  for (const value of [null, {}, {...valid,enabled:false}, {...valid,slots:['invalid']}, {...valid,fulfillment_modes:[]}, {...valid,preparation_minutes:-1}]) assert.equal(parseScheduleOptions(value), null);
});
test('checkout preserves existing immediate contract and forwards selected schedule only when present', () => {
  const immediate=buildOrderRequest({...order,scheduledFor:undefined});
  assert.equal('scheduledFor' in immediate, false);
  assert.equal('fulfillmentMode' in immediate, false);
  const scheduled=buildOrderRequest({...order,fulfillmentMode:'pickup'});
  assert.equal(scheduled.scheduledFor, order.scheduledFor);
  assert.equal(scheduled.fulfillmentMode,'pickup');
});

test('printed pickup schedule shows the official time without printing a delivery address', () => {
  const html = renderToStaticMarkup(React.createElement(OrderReceiptModal, {
    order: {...order, fulfillmentMode:'pickup', subtotal:20, deliveryFee:0, total:20, paymentMethod:'cash', deliveryAddress:{street:'Não entregar aqui',number:'1'}},
    settings:{name:'Loja de teste'}, onClose(){},
  }));
  for (const text of ['Retirada na loja', 'Agendado para:', '26/10', '00:30', '(Brasília)']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('Não entregar aqui'));
});

test('immediate delivery receipt preserves the address and has no scheduling notice', () => {
  const html = renderToStaticMarkup(React.createElement(OrderReceiptModal, {
    order: {...order, scheduledFor:undefined, subtotal:20, deliveryFee:5, total:25, paymentMethod:'cash', deliveryAddress:{street:'Rua de teste',number:'10',neighborhood:'Centro',complement:'Portão azul'}},
    settings:{name:'Loja de teste'}, onClose(){},
  }));
  for (const text of ['Rua de teste', '10', 'Centro', 'Portão azul']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('Agendado para:'));
});
