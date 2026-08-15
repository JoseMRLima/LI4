import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export default function BarcodeScannerModal({ products, onScanned, onClose }) {
  const [phase, setPhase] = useState('scanning'); // 'scanning' | 'found'
  const [scannedProduct, setScannedProduct] = useState(null);

  // Câmara: produto aleatório após 2s
  useEffect(() => {
    const timer = setTimeout(() => {
      const activeProducts = products.filter(p => p.is_active !== false);
      if (activeProducts.length === 0) { onClose(); return; }
      const product = activeProducts[Math.floor(Math.random() * activeProducts.length)];
      setScannedProduct(product);
      setPhase('found');
    }, 2000);
    return () => clearTimeout(timer);
  }, [products]);

  // Auto-fechar após encontrar produto
  useEffect(() => {
    if (phase !== 'found' || !scannedProduct) return;
    const timer = setTimeout(() => {
      onScanned(scannedProduct);
      onClose();
    }, 1000);
    return () => clearTimeout(timer);
  }, [phase, scannedProduct]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="relative bg-zinc-900 rounded-2xl overflow-hidden w-80 shadow-2xl border border-zinc-700">

        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <span className="text-white text-sm font-semibold">
            {phase === 'scanning' ? 'A ler código de barras...' : 'Produto encontrado!'}
          </span>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewfinder */}
        <div className="relative bg-black w-full h-48 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'1\'/%3E%3C/svg%3E")', backgroundSize: '100px' }}
          />

          {phase === 'scanning' && (
            <>
              {[
                'top-4 left-6 border-t-2 border-l-2 rounded-tl-md',
                'top-4 right-6 border-t-2 border-r-2 rounded-tr-md',
                'bottom-4 left-6 border-b-2 border-l-2 rounded-bl-md',
                'bottom-4 right-6 border-b-2 border-r-2 rounded-br-md',
              ].map((cls, i) => (
                <div key={i} className={`absolute w-6 h-6 border-green-400 ${cls}`} />
              ))}
              <div
                className="absolute left-8 right-8 h-0.5 bg-green-400 shadow-[0_0_8px_2px_rgba(74,222,128,0.6)]"
                style={{ animation: 'scanLine 1.5s ease-in-out infinite' }}
              />
              <div className="flex gap-px opacity-20">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="bg-white" style={{ width: i % 3 === 0 ? 3 : 2, height: 40 + (i % 4) * 8 }} />
                ))}
              </div>
            </>
          )}

          {phase === 'found' && (
            <div className="flex flex-col items-center gap-2 animate-pulse">
              <div className="text-green-400 text-4xl">✓</div>
              <div className="text-white text-xs font-mono tracking-widest">{scannedProduct?.barcode}</div>
            </div>
          )}
        </div>

        {phase === 'found' && (
          <div className="px-4 py-3 text-center">
            <p className="text-white text-sm font-semibold">{scannedProduct?.name}</p>
            <p className="text-green-400 text-sm font-bold">{scannedProduct?.price?.toFixed(2)}€</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scanLine {
          0%   { top: 20%; }
          50%  { top: 75%; }
          100% { top: 20%; }
        }
      `}</style>
    </div>
  );
}
