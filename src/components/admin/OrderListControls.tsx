import React from 'react';

export const ORDER_PAGE_SIZE = 4;

export function OrderListControls({ total, limit, onLimitChange }: {
  total:number; limit:number; onLimitChange:(limit:number)=>void;
}) {
  if(total<=ORDER_PAGE_SIZE)return null;
  const shown=Math.min(total,limit);
  return <div className="order-list-controls" role="group" aria-label="Quantidade de pedidos exibidos">
    <p role="status">Mostrando {shown} de {total}</p>
    <div>
      {shown<total&&<><button type="button" onClick={()=>onLimitChange(shown+ORDER_PAGE_SIZE)}>Ver mais {Math.min(ORDER_PAGE_SIZE,total-shown)}</button><button type="button" onClick={()=>onLimitChange(Infinity)}>Mostrar todos ({total})</button></>}
      {shown>ORDER_PAGE_SIZE&&<button type="button" onClick={()=>onLimitChange(ORDER_PAGE_SIZE)}>Recolher para 4</button>}
    </div>
  </div>;
}
