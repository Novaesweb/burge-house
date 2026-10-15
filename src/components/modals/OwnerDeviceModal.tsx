import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Laptop,
  Bell,
  Volume2,
  CheckCircle2,
  ShieldCheck,
  Store,
  Check,
  RefreshCw,
} from 'lucide-react';
import {
  detectDeviceInfo,
  checkDeviceRegistration,
  saveDeviceRegistration,
  RegisteredDevice,
} from '../../utils/deviceIdentifier';
import { enableAudio, playNewOrderSound } from '../../utils/audioAlert';

interface OwnerDeviceModalProps {
  siteId: string;
  ownerName: string;
  onAccepted: (registeredDevice: RegisteredDevice) => void;
}

export const OwnerDeviceModal: React.FC<OwnerDeviceModalProps> = ({
  siteId,
  ownerName,
  onAccepted,
}) => {
  const [deviceInfo] = useState(() => detectDeviceInfo());
  const [isRecognizedDevice, setIsRecognizedDevice] = useState<boolean | null>(null);
  const [audioAccepted, setAudioAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function verify() {
      const check = await checkDeviceRegistration(siteId, 'owner', ownerName);
      setIsRecognizedDevice(check.isRecognized);

      const locallyAccepted =
        localStorage.getItem(`owner_device_accepted_${deviceInfo.deviceId}`) === 'true';
      if (check.isRecognized && locallyAccepted) {
        setAudioAccepted(true);
      }
    }
    verify();
  }, [siteId, ownerName, deviceInfo.deviceId]);

  const handleEnableAudio = () => {
    enableAudio();
    playNewOrderSound();
    setAudioAccepted(true);

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  };

  const handleConfirmOnboarding = async () => {
    if (!audioAccepted) return;

    setIsSubmitting(true);
    const registered = await saveDeviceRegistration(siteId, 'owner', ownerName, {
      audioAccepted: true,
      notificationsAccepted: true,
    });
    setIsSubmitting(false);
    onAccepted(registered);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="w-full max-w-sm bg-neutral-900 border border-red-500/40 rounded-3xl p-6 shadow-2xl text-white space-y-5">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-600 via-rose-600 to-amber-600 flex items-center justify-center mx-auto shadow-lg shadow-red-950/60 mb-2">
            <Store className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-lg font-black text-white tracking-tight">
            Painel do Proprietário
          </h2>
          <p className="text-xs text-neutral-400">
            Olá, <strong>{ownerName}</strong>! Configure este aparelho para receber pedidos com alerta sonoro.
          </p>
        </div>

        {/* Device Identification Card */}
        <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-neutral-400 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1">
              {deviceInfo.isMobile ? (
                <Smartphone className="w-3.5 h-3.5 text-red-500" />
              ) : (
                <Laptop className="w-3.5 h-3.5 text-red-500" />
              )}
              <span>Identificação do Aparelho</span>
            </span>
            {isRecognizedDevice ? (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Aparelho Reconhecido
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/30">
                Novo Aparelho
              </span>
            )}
          </div>

          <div className="font-bold text-white text-sm flex items-center gap-1.5">
            <span>{deviceInfo.deviceModel}</span>
            <span className="text-neutral-500 text-xs font-normal">
              ({deviceInfo.os} • {deviceInfo.browser})
            </span>
          </div>

          <p className="text-[10px] text-neutral-500 font-mono truncate">
            ID Único: {deviceInfo.deviceId}
          </p>
        </div>

        {/* Audio & Notification Acceptance Requirement */}
        <div
          className={`p-3.5 rounded-2xl border transition-all text-xs ${
            audioAccepted
              ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
              : 'bg-neutral-950 border-neutral-800 text-neutral-300'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  audioAccepted ? 'bg-emerald-500 text-white' : 'bg-neutral-800 text-red-500'
                }`}
              >
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-white">
                  Notificações & Áudio de Pedidos
                </h4>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Ativa o toque de campainha imediato sempre que entrar um novo pedido no delivery.
                </p>
              </div>
            </div>

            {audioAccepted ? (
              <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </span>
            ) : (
              <button
                onClick={handleEnableAudio}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-[11px] font-bold shadow-md shadow-red-950/40 flex-shrink-0 flex items-center gap-1"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Ativar Som</span>
              </button>
            )}
          </div>
        </div>

        {/* Submit Action */}
        <button
          onClick={handleConfirmOnboarding}
          disabled={!audioAccepted || isSubmitting}
          className={`w-full py-3.5 rounded-2xl font-bold text-sm shadow-xl flex items-center justify-center gap-2 transition-all ${
            audioAccepted && !isSubmitting
              ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-red-950/60 active:scale-98'
              : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Registrando...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-5 h-5" />
              <span>Entrar no Painel do Restaurante</span>
            </>
          )}
        </button>

        <p className="text-[10px] text-neutral-500 text-center">
          Sem rastreamento para o dono. Apenas áudio e notificações para não perder vendas.
        </p>
      </div>
    </div>
  );
};


