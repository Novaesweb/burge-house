import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NewOrderQueue } from '../src/components/admin/NewOrderQueue.tsx';
import { OrderStageBoard } from '../src/components/admin/OrderStageBoard.tsx';
import { ORDER_STAGES } from '../src/utils/adminOrders.ts';
import { OrderListControls } from '../src/components/admin/OrderListControls.tsx';
import { OrderAdvanceButton } from '../src/components/admin/OrderCard.tsx';

const order=(id,status='recebido')=>({id:String(id),siteId:'test-store',orderNumber:id,status,createdAt:new Date(Date.parse('2026-10-22T10:00:00Z')+id*60000).toISOString(),updatedAt:new Date(Date.parse('2026-10-22T10:00:00Z')+id*60000).toISOString(),customerName:`Cliente ${id}`,customerPhone:'11900000000',deliveryAddress:{street:'Rua de Teste',number:'1'},paymentMethod:'pix',isPaid:false,items:[{productId:'product',name:'Produto fictício',quantity:1,price:20}],total:20});
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
test('twenty delivered orders show only four overview cards while preserving the full count and search',()=>{
 const snapshot=Array.from({length:20},(_,index)=>order(index+1,'entregue'));
 const props={orders:snapshot,search:'',now:Date.parse('2026-10-22T11:00:00Z'),onOpenStage(){},onDetails(){},onWhatsApp(){}};
 const html=renderToStaticMarkup(React.createElement(OrderStageBoard,props));
 assert.equal((html.match(/class="order-kanban-card"/g)||[]).length,4);
 assert.ok(html.includes('Mostrando 4 de 20'));
 assert.ok(html.includes('Mostrar todos (20)'));
 const found=renderToStaticMarkup(React.createElement(OrderStageBoard,{...props,search:'Cliente 20'}));
 assert.ok(found.includes('aria-label="Pedido 20"'));
 assert.equal(snapshot.length,20);
});
test('twenty incoming orders keep one focus card and at most four entries in the collapsed preview',()=>{
 const html=render(Array.from({length:20},(_,index)=>order(index+1)));
 assert.equal((html.match(/data-order-id=/g)||[]).length,1);
 const preview=html.split('<details class="pending-order-list">')[1];
 assert.equal((preview.match(/<li>/g)||[]).length,4);
 assert.ok(preview.includes('Mostrando 4 de 19'));
 assert.ok(html.includes('1 DE 20'));
});
test('display controls allow four more, all, and collapse without changing orders',()=>{
 const changes=[];
 const controls=OrderListControls({total:20,limit:4,onLimitChange:value=>changes.push(value)});
 const actionFragment=controls.props.children[1].props.children[0];
 actionFragment.props.children[0].props.onClick();
 actionFragment.props.children[1].props.onClick();
 const expanded=OrderListControls({total:20,limit:Infinity,onLimitChange:value=>changes.push(value)});
 expanded.props.children[1].props.children[1].props.onClick();
 assert.deepEqual(changes,[8,Infinity,4]);
 assert.equal(OrderListControls({total:4,limit:4,onLimitChange(){}}),null);
});

test('quick buttons advance only to the existing next step without opening details',()=>{
 const moves=[];
 const steps=[['recebido','preparando','Iniciar preparo'],['preparando','itens_separados','Marcar como separado'],['itens_separados','esperando_motoboy','Aguardar motoboy'],['esperando_motoboy','saiu_para_entrega','Saiu para entrega'],['saiu_para_entrega','entregue','Marcar como entregue']];
 for(const [status,next,label] of steps){
  const button=OrderAdvanceButton({order:order(1,status),onAdvance:value=>moves.push(value)});
  assert.equal(button.props.type,'button');
  assert.equal(button.props['aria-label'],`Pedido #1: ${label}`);
  button.props.onClick();
  assert.equal(moves.at(-1),next);
 }
 assert.equal(moves.length,5);
 for(const status of ['entregue','cancelado'])assert.equal(OrderAdvanceButton({order:order(1,status),onAdvance(){throw new Error('TERMINAL_ORDER_MUST_NOT_MOVE');}}),null);
});

test('busy and disconnected quick actions cannot dispatch a status update',()=>{
 for(const props of [{busy:true},{disabled:true}]){
  const button=OrderAdvanceButton({order:order(1,'preparando'),...props,onAdvance(){throw new Error('MUST_NOT_UPDATE');}});
  assert.equal(button.props.disabled,true);
  button.props.onClick();
 }
});

test('overview exposes quick actions on active stages and keeps received orders oldest first',()=>{
 const snapshot=ORDER_STAGES.map((stage,index)=>order(index+1,stage.id));snapshot.push(order(8));
 const props={orders:snapshot,search:'',now:Date.parse('2026-10-22T11:00:00Z'),onOpenStage(){},onDetails(){},onWhatsApp(){},onAdvance(){}};
 const html=renderToStaticMarkup(React.createElement(OrderStageBoard,props));
 assert.equal((html.match(/class="order-primary /g)||[]).length,5);
 assert.ok(html.includes('aria-label="Pedido #1: Iniciar preparo"'));
 assert.ok(!html.includes('aria-label="Pedido #8: Iniciar preparo"'));
 assert.ok(!html.includes('aria-label="Pedido #6: Marcar como entregue"'));
 const blocked=renderToStaticMarkup(React.createElement(OrderStageBoard,{...props,connected:false}));
 assert.equal((blocked.match(/class="order-primary [^"]*" disabled=""/g)||[]).length,5);
 const updating=renderToStaticMarkup(React.createElement(OrderStageBoard,{...props,busyIds:['2']}));
 assert.match(updating,/disabled="" aria-busy="true" aria-label="Pedido #2: Marcar como separado"/);
});
