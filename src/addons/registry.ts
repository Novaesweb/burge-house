import type { AdminView } from '../context/StoreContext';

export type AddonCode =
  | 'novaes_fideliza' | 'novaes-os' | 'novaes-mesa' | 'novaes-gift' | 'novaes-tv'
  | 'novaes-whatsapp-notify' | 'whatsapp-oficial-activation' | 'novaes-print-connect'
  | 'custom-integrations' | 'novaes-promo' | 'novaes-finance' | 'novaes-equipe'
  | 'novaes-insights' | 'novaes-marketing' | 'domain-setup' | 'custom-training'
  | 'one_off-adjustment' | 'banner-update' | 'product-registration-pack-10'
  | 'extraordinary-support' | 'custom-development' | 'novaes-backup-plus'
  | 'novaes-multiusuario' | 'novaes-multiunidade' | 'novaes-import';

export const addonRegistry: Record<AddonCode, { name: string; existingSurface?: string }> = {
  'novaes_fideliza': { name: 'Novaes Fideliza' },
  'novaes-os': { name: 'Novaes OS' },
  'novaes-mesa': { name: 'Novaes Mesa' },
  'novaes-gift': { name: 'Novaes Gift' },
  'novaes-tv': { name: 'Novaes TV' },
  'novaes-whatsapp-notify': { name: 'Novaes WhatsApp Notify', existingSurface: 'Avisos de pedido por WhatsApp' },
  'whatsapp-oficial-activation': { name: 'Ativação WhatsApp Oficial' },
  'novaes-print-connect': { name: 'Novaes Print Connect', existingSurface: 'Comandas e impressão de pedidos' },
  'custom-integrations': { name: 'Integrações Personalizadas' },
  'novaes-promo': { name: 'Novaes Promo', existingSurface: 'Cupons e combos' },
  'novaes-finance': { name: 'Novaes Finance', existingSurface: 'Financeiro avançado' },
  'novaes-equipe': { name: 'Novaes Equipe', existingSurface: 'Equipe e acessos' },
  'novaes-insights': { name: 'Novaes Insights', existingSurface: 'Relatórios' },
  'novaes-marketing': { name: 'Novaes Marketing', existingSurface: 'Campanhas e consentimento' },
  'domain-setup': { name: 'Configuração de Domínio' },
  'custom-training': { name: 'Treinamento Personalizado' },
  'one_off-adjustment': { name: 'Ajuste Avulso' },
  'banner-update': { name: 'Atualização de Banner', existingSurface: 'Configurações visuais' },
  'product-registration-pack-10': { name: 'Cadastro de Produtos — Pacote 10', existingSurface: 'Produtos e categorias' },
  'extraordinary-support': { name: 'Suporte Extraordinário' },
  'custom-development': { name: 'Desenvolvimento Sob Medida' },
  'novaes-backup-plus': { name: 'Novaes Backup Plus' },
  'novaes-multiusuario': { name: 'Novaes Multiusuário', existingSurface: 'Equipe e acessos' },
  'novaes-multiunidade': { name: 'Novaes Multiunidade' },
  'novaes-import': { name: 'Novaes Import' },
};

export const adminViewEntitlements: Partial<Record<AdminView, AddonCode[]>> = {
  marketing: ['novaes-marketing'],
  team: ['novaes-equipe', 'novaes-multiusuario'],
  reports: ['novaes-insights'],
};
