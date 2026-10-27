import {requireSupabase} from '../lib/supabase';
export async function loadPremiumFeatures(storeId:string):Promise<{coupons:boolean;scheduling:boolean}|null>{
  const{data,error}=await requireSupabase().rpc('delivery_premium_features',{p_store_id:storeId});
  // Preserve the existing coupon integration during the reviewed SQL rollout.
  // Null is unknown, never a new grant of permission; checkout/RLS remain authoritative.
  if(error?.code==='PGRST202'||error?.code==='42883')return null;
  if(error||!data||typeof data.coupons!=='boolean'||typeof data.scheduling!=='boolean')throw new Error('Não foi possível confirmar os recursos do plano.');
  return{coupons:data.coupons,scheduling:data.scheduling};
}
