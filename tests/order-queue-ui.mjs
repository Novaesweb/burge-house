import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NewOrderQueue } from '../src/components/admin/NewOrderQueue.tsx';
import { OrderStageBoard } from '../src/components/admin/OrderStageBoard.tsx';
import { ORDER_STAGES } from '../src/utils/adminOrders.ts';

const order=(id,status='recebido')=>({id:String(id),siteId:'test-store',orderNumber:id,status,createdAt:`2026-10-22T10:0${id}:00Z`,updatedAt:`2026-10-22T10:0${id}:00Z`,customerName:`Cliente ${id}`,customerPhone:'11900000000',deliveryAddress:{street:'Rua de Teste',number:'1'},paymentMethod:'pix',isPaid:false,items:[{productId:'product',name:'Produto fictício',quantity:1,price:20}],total:20});
const render=(orders,extra={})=>renderToStaticMarkup(React.createElement(NewOrderQueue,{orders,now:Date.parse('2026-10-22T11:00:00Z'),busyIds:[],search:'',connected:true,onAccept(){},onReject(){},onDetails(){},onPrint(){},onWhatsApp(){},...extra}));

test('five pending orders render exactly one full receiving card and four collapsed queue entries',()=>{
 const html=render([order(5),order(2),order(4),order(1),order(3),order(6,'preparando')]);
 assert.equal((html.match(/data-order-id=/g)||[]).length,1);
 assert.ok(html.includes('data-order-id="1"'));
 assert.ok(html.includes('1 DE 5'));
 assert.ok(html.includes('Próximos pedidos <b>4</b>'));
 assert.ok(!/<details[^>]*\sopen/.test(html));
 assert.ok(!html.includes('Cliente 6'));
 for(const text of ['Aceitar pedido','Recusar pedido','WhatsApp','Imprimir','Histórico do pedido','Rua de Teste','Produto fictício','Pagamento pendente'])assert.ok(html.includes(text),text);
});
test('confirmed snapshots advance the full card; failures retain the same card with actions disabled',()=>{
 const snapshot=[order(1),order(2)];
 assert.ok(render(snapshot).includes('data-order-id="1"'));
 assert.ok(render(snapshot.map(item=>item.id==='1'?{...item,status:'preparando'}:item)).includes('data-order-id="2"'));
 const disconnected=render(snapshot,{connected:false});
 assert.ok(disconnected.includes('data-order-id="1"'));
 assert.ok(disconnected.includes('conexão com os pedidos está indisponível'));
 assert.match(disconnected,/disabled=""[^>]*>Aceitar pedido/);
 assert.match(disconnected,/disabled=""[^>]*>.*?Recusar pedido/);
});
test('search never changes oldest-first service order and an empty queue has no action card',()=>{
 assert.ok(render([order(1),order(2)],{search:'Cliente 2'}).includes('data-order-id="1"'));
 const empty=render([order(1,'preparando'),order(2,'cancelado')]);
 assert.ok(empty.includes('Nenhum pedido nesta etapa'));
 assert.equal((empty.match(/data-order-id=/g)||[]).length,0);
});
test('overview renders seven separate columns and only the oldest pending order as a queue preview',()=>{
 const snapshot=ORDER_STAGES.map((stage,index)=>order(index+1,stage.id));
 snapshot.push(order(8));
 const html=renderToStaticMarkup(React.createElement(OrderStageBoard,{orders:snapshot,search:'',now:Date.parse('2026-10-22T11:00:00Z'),onOpenStage(){},onDetails(){},onWhatsApp(){}}));
 const columns=html.split(/<section class="order-kanban-column /).slice(1);
 assert.equal(columns.length,7);
 ORDER_STAGES.forEach((stage,index)=>{
  assert.ok(columns[index].includes(`aria-label="${stage.label}"`));
  assert.ok(columns[index].includes(`aria-label="Pedido ${index+1}"`));
 });
 assert.ok(!html.includes('aria-label="Pedido 8"'));
 assert.ok(html.includes('na fila recolhida'));
});
