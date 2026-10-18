import React, { useState } from 'react';
import { Star, Send, CheckCircle2, Bike, Utensils } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useStore } from '../context/StoreContext';
import { Order, OrderReview } from '../types';

interface OrderRatingCardProps {
  order: Order;
}

export const OrderRatingCard: React.FC<OrderRatingCardProps> = ({ order }) => {
  const { submitOrderReviewAction } = useStore();

  const [foodRating, setFoodRating] = useState<number>(order.review?.foodRating || 5);
  const [deliveryRating, setDeliveryRating] = useState<number>(
    order.review?.deliveryRating || 5
  );
  const [comment, setComment] = useState<string>(order.review?.comment || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(!!order.review);
  const [error, setError] = useState('');

  const foodLabels: Record<number, string> = {
    1: '😞 Muito Ruim',
    2: '🙁 Poderia melhorar',
    3: '😐 Razoável',
    4: '😋 Muito Gostoso!',
    5: '🤤 Incrível / Perfeito! 🔥',
  };

  const deliveryLabels: Record<number, string> = {
    1: '😞 Demorada',
    2: '🙁 Regular',
    3: '😐 Normal',
    4: '🛵 Rápida & Cuidadosa',
    5: '⚡ Super Rápida! 🌟',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (foodRating === 0 || deliveryRating === 0) return;

    try {
      setIsSubmitting(true);
      setError('');
      const review: OrderReview = {
        foodRating,
        deliveryRating,
        comment: comment.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      await submitOrderReviewAction(order.id, review);
      setSubmitted(true);

      // Trigger celebratory confetti
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#ef4444', '#10b981', '#f59e0b', '#8b5cf6'],
        });
      } catch (e) {}
    } catch (err) {
      setError('Não foi possível enviar sua avaliação. Confira a conexão e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted || order.review) {
    return (
      <div className="rounded-3xl bg-neutral-900/90 border border-neutral-800 p-5 text-center space-y-3 shadow-xl my-4 animate-in zoom-in-95 duration-200">
        <div className="w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-md">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-base font-black text-white">
            Avaliação Enviada!
          </h4>
          <p className="text-xs text-neutral-400 mt-0.5">
            Muito obrigado pelo seu feedback. Ele nos ajuda a melhorar sempre!
          </p>
        </div>

        {/* Display given ratings */}
        <div className="grid grid-cols-2 gap-2 pt-2 text-left">
          <div className="p-3 rounded-2xl bg-black/60 border border-neutral-800 space-y-1">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
              <Utensils className="w-3 h-3 text-red-500" />
              <span>Comida</span>
            </span>
            <div className="flex items-center gap-1 text-amber-400">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-3.5 h-3.5 ${
                    s <= (order.review?.foodRating || foodRating)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-neutral-700'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-black/60 border border-neutral-800 space-y-1">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
              <Bike className="w-3 h-3 text-orange-500" />
              <span>Entrega</span>
            </span>
            <div className="flex items-center gap-1 text-amber-400">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-3.5 h-3.5 ${
                    s <= (order.review?.deliveryRating || deliveryRating)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-neutral-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {(order.review?.comment || comment) && (
          <p className="p-3 rounded-2xl bg-neutral-950 border border-neutral-850 text-xs text-neutral-300 italic text-left">
            "{order.review?.comment || comment}"
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-neutral-900/95 border border-neutral-800 p-5 shadow-2xl my-4 text-left space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center gap-2.5 pb-2 border-b border-neutral-800">
        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md">
          <Star className="w-5 h-5 fill-white" />
        </div>
        <div>
          <h3 className="text-sm font-black text-white tracking-tight">
            Avaliar Pedido #{order.orderNumber}
          </h3>
          <p className="text-[11px] text-neutral-400 font-medium">
            Conte como foi sua experiência conosco hoje
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        {/* Rating 1: A Comida */}
        <div className="space-y-1.5 p-3 rounded-2xl bg-black/50 border border-neutral-850">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Utensils className="w-3.5 h-3.5 text-red-500" />
              <span>Como estava a comida?</span>
            </span>
            <span className="text-[11px] font-black text-amber-400">
              {foodLabels[foodRating] || ''}
            </span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setFoodRating(star)}
                className="p-1 rounded-xl hover:scale-115 active:scale-95 transition-transform"
                title={`${star} estrelas`}
              >
                <Star
                  className={`w-7 h-7 transition-colors ${
                    star <= foodRating
                      ? 'fill-amber-400 text-amber-400 filter drop-shadow(0 0 4px rgba(251,191,36,0.4))'
                      : 'text-neutral-700 hover:text-neutral-500'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Rating 2: A Entrega */}
        <div className="space-y-1.5 p-3 rounded-2xl bg-black/50 border border-neutral-850">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Bike className="w-3.5 h-3.5 text-orange-500" />
              <span>Como foi a entrega?</span>
            </span>
            <span className="text-[11px] font-black text-amber-400">
              {deliveryLabels[deliveryRating] || ''}
            </span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setDeliveryRating(star)}
                className="p-1 rounded-xl hover:scale-115 active:scale-95 transition-transform"
                title={`${star} estrelas`}
              >
                <Star
                  className={`w-7 h-7 transition-colors ${
                    star <= deliveryRating
                      ? 'fill-amber-400 text-amber-400 filter drop-shadow(0 0 4px rgba(251,191,36,0.4))'
                      : 'text-neutral-700 hover:text-neutral-500'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Optional Comment */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-neutral-400 block">
            Deixe um recado ou elogio (Opcional):
          </label>
          <textarea
            value={comment}
            maxLength={1000}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ex: O lanche estava maravilhoso e chegou super quentinho e rápido!"
            rows={2}
            className="w-full text-xs p-3 rounded-2xl bg-black border border-neutral-800 text-white placeholder-neutral-600 focus:outline-none focus:border-red-500 font-medium"
          />
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-sm shadow-xl shadow-orange-950/60 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          <span>{isSubmitting ? 'Enviando Avaliação...' : 'Enviar Avaliação'}</span>
        </button>
      </form>
    </div>
  );
};


