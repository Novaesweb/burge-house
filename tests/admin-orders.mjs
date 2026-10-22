import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ORDER_STAGES,selectOrders,orderCounts,nextOrderAction,newUnseenOrderIds,reviewedOrders,whatsappNumber,formatOrderAddress,ordersForStore,orderStageFromUrl,orderStageUrl,pendingOrderQueue} from '../src/utils/adminOrders.ts';
const order=(id,status,createdAt,extra={})=>({id,siteId:'fixture-store',orderNumber:Number(id)||1,status,createdAt,updatedAt:createdAt,customerName:'Cliente de teste',customerPhone:'(51) 9489-2414',items:[],deliveryAddress:{street:'Rua de teste',number:'10',neighborhood:'Centro'},total:25,...extra});
const rows=[order('1','entregue','2026-10-18T10:00:00Z'),order('2','recebido','2026-10-18T09:00:00Z'),order('3','preparando','2026-10-18T11:00:00Z'),order('4','recebido','2026-10-18T12:00:00Z'),order('5','cancelado','2026-10-18T13:00:00Z')];
test('orders, counters, notifications and reviews are limited to the current store',()=>{const mixed=[...rows,order('99','recebido','2026-10-18T15:00:00Z',{siteId:'another-store',review:{foodRating:1}})];const scoped=ordersForStore(mixed,'fixture-store');assert.equal(scoped.length,rows.length);assert.equal(orderCounts(scoped).recebido,2);assert.deepEqual(newUnseenOrderIds(scoped,new Set()),['2','4']);assert.equal(reviewedOrders(scoped).length,0);});
test('new orders first, active orders next, finished orders last; newest within groups',()=>{assert.deepEqual(selectOrders(rows,'todos','').map(order=>order.id),['4','2','3','5','1']);assert.deepEqual(rows.map(order=>order.id),['1','2','3','4','5']);});
test('each of the seven filters has a live count, including cancelled',()=>{const counts=orderCounts(rows);assert.equal(counts.recebido,2);assert.equal(counts.cancelado,1);assert.equal(counts.itens_separados,0);for(const stage of ORDER_STAGES)assert.equal(selectOrders(rows,stage.id,'').length,counts[stage.id]);});
test('every exclusive stage excludes all other stages, including new orders and legacy statuses',()=>{
  const allStages=ORDER_STAGES.map((stage,index)=>order(String(index+10),stage.id,'2026-10-18T10:00:00Z'));
  allStages.push(order('30','pronto','2026-10-18T10:00:00Z'),order('31','aguardando_entregador','2026-10-18T10:00:00Z'));
  for(const stage of ORDER_STAGES){
    const selected=selectOrders(allStages,stage.id,'');
    assert.equal(selected.length,orderCounts(allStages)[stage.id]);
    if(stage.id!=='recebido')assert.ok(selected.every(item=>item.status!=='recebido'));
    assert.ok(selected.every(item=>item.status===stage.id||(stage.id==='itens_separados'&&item.status==='pronto')||(stage.id==='esperando_motoboy'&&item.status==='aguardando_entregador')));
  }
  assert.equal(selectOrders(allStages,'todos','').length,allStages.length);
});
test('updated snapshots move an order between stages and update both counters without changing the source',()=>{
  let snapshot=[order('50','recebido','2026-10-18T10:00:00Z')];
  for(const status of ['preparando','itens_separados','esperando_motoboy','saiu_para_entrega','entregue']){
    const previous=snapshot[0].status;
    snapshot=snapshot.map(item=>({...item,status}));
    assert.equal(selectOrders(snapshot,previous,'').length,0);
    assert.equal(selectOrders(snapshot,status,'')[0].id,'50');
    assert.equal(orderCounts(snapshot)[previous],0);
    assert.equal(orderCounts(snapshot)[status],1);
  }
});
test('stage URLs survive reload, preserve other URL data and reject unknown stages',()=>{
  const initial='http://localhost:3001/?origem=teste#/admdono';
  for(const stage of ['todos',...ORDER_STAGES.map(item=>item.id)]){
    const href=orderStageUrl(initial,stage);
    assert.equal(orderStageFromUrl(href),stage);
    assert.equal(new URL(href).hash,'#/admdono');
    assert.equal(new URL(href).searchParams.get('origem'),'teste');
  }
  assert.equal(orderStageFromUrl(initial),null);
  assert.equal(orderStageFromUrl('http://localhost:3001/?etapa=invalido#/admdono'),null);
});
test('receiving queue is oldest first, contains only pending orders and rebuilds after acceptance or refusal',()=>{
  const snapshot=[...rows,order('6','recebido','2026-10-18T08:00:00Z'),order('7','recebido','2026-10-18T10:00:00Z'),order('8','recebido','2026-10-18T14:00:00Z')];
  assert.deepEqual(pendingOrderQueue(snapshot).map(item=>item.id),['6','2','7','4','8']);
  const accepted=snapshot.map(item=>item.id==='6'?{...item,status:'preparando'}:item);
  assert.equal(pendingOrderQueue(accepted)[0].id,'2');
  const refused=accepted.map(item=>item.id==='2'?{...item,status:'cancelado'}:item);
  assert.deepEqual(pendingOrderQueue(refused).map(item=>item.id),['7','4','8']);
  assert.equal(refused.find(item=>item.id==='2').status,'cancelado');
  assert.equal(refused.length,snapshot.length);
  assert.deepEqual(pendingOrderQueue(JSON.parse(JSON.stringify(refused))),pendingOrderQueue(refused));
  assert.equal(pendingOrderQueue(refused.map(item=>({...item,status:'entregue'}))).length,0);
});
test('same selection powers cards and list, combines name, order and phone search',()=>{assert.equal(selectOrders(rows,'recebido','#4')[0].id,'4');assert.equal(selectOrders(rows,'recebido','cliente').length,2);assert.equal(selectOrders(rows,'todos','5194892414').length,5);assert.equal(selectOrders(rows,'preparando','inexistente').length,0);});
test('next buttons follow existing canonical workflow and stop at delivered/cancelled',()=>{const sequence=['recebido','preparando','itens_separados','esperando_motoboy','saiu_para_entrega','entregue'];for(let index=0;index<sequence.length-1;index++)assert.equal(nextOrderAction(sequence[index]).status,sequence[index+1]);assert.equal(nextOrderAction('entregue'),null);assert.equal(nextOrderAction('cancelado'),null);assert.equal(nextOrderAction('pronto').status,'esperando_motoboy');});
test('a new order alerts once, not on status/payment updates or repeated snapshots',()=>{const seen=new Set();const first=newUnseenOrderIds(rows,seen);first.forEach(id=>seen.add(id));assert.deepEqual(first,['2','4']);assert.deepEqual(newUnseenOrderIds(rows.map(item=>({...item,isPaid:true})),seen),[]);assert.deepEqual(newUnseenOrderIds([...rows,order('6','recebido','2026-10-18T14:00:00Z')],seen),['6']);});
test('reviews are read from original orders, most recent first, absent delivery scores stay absent',()=>{const reviewed=[...rows,order('7','entregue','2026-10-18T10:00:00Z',{review:{foodRating:4,createdAt:'2026-10-18T12:00:00Z'}}),order('8','entregue','2026-10-18T10:00:00Z',{review:{foodRating:2,deliveryRating:3,comment:'Comentário real do teste',createdAt:'2026-10-18T15:00:00Z'}})];assert.deepEqual(reviewedOrders(reviewed).map(item=>item.id),['8','7']);assert.equal(reviewedOrders(reviewed)[1].review.deliveryRating,undefined);});
test('contact links preserve country code and addresses preserve actual registered content',()=>{assert.equal(whatsappNumber('555194892414'),'555194892414');assert.equal(whatsappNumber('(51) 9489-2414'),'555194892414');assert.equal(formatOrderAddress(rows[0]),'Rua de teste, 10 · Centro');assert.equal(formatOrderAddress({...rows[0],deliveryAddress:null}),'Endereço não informado');});
