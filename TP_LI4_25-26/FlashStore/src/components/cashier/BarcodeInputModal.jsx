import React, { useRef, useState } from 'react';
import { X, Barcode } from 'lucide-react';
import { toast } from 'sonner';

export default function BarcodeInputModal({ products, onScanned, onClose }) {
  const [barcode, setBarcode] = useState('');
  const inputRef = useRef(null);

  const handleScan = () => {
    const code = barcode.trim();
    if (!code) return;
    const found = products.find(p => p.is_active !== false && p.barcode === code);
    if (found) {
      onScanned(found);
      onClose();
    } else {
      toast.error(`Código "${code}" não encontrado.`);
      setBarcode('');
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-card rounded-2xl shadow-2xl w-80 border border-border">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <Barcode className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Inserir código de barras</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-5 space-y-3">
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={barcode}
            onChange={e => setBarcode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleScan()}
            placeholder="Ex: 5601234567890"
            className="w-full bg-background text-foreground text-sm rounded-lg px-3 py-2 border border-border focus:border-primary focus:outline-none placeholder-muted-foreground font-mono"
          />
          <button
            onClick={handleScan}
            disabled={!barcode.trim()}
            className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            Adicionar ao carrinho
          </button>
        </div>
      </div>
    </div>
  );
}
