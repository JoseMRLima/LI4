import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Credenciais do gerente para autorizar anulações e estornos no POS.
 */
export default function ManagerAuthFields({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  disabled = false,
}) {
  return (
    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
      <p className="text-xs font-medium text-amber-900">Autorização do gerente</p>
      <div className="space-y-1">
        <Label className="text-xs">Email do gerente</Label>
        <Input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          disabled={disabled}
          placeholder="gerente@..."
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Palavra-passe</Label>
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
