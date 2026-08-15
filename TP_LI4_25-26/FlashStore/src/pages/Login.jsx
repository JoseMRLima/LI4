/**
 * FlashStore — Página de Login Local
 * Usa navigate() do React Router (SEM window.location.href) para evitar loops.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, checkAppState, loginOffline } = useAuth();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // Se já está autenticado (ex: voltou para /login com sessão ativa), redireciona
  useEffect(() => {
    if (isAuthenticated) {
      const next = searchParams.get('next') || '/';
      navigate(decodeURIComponent(next), { replace: true });
    }
  }, [isAuthenticated, navigate, searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // 1. Faz login → guarda JWT no localStorage
      await api.auth.login(email, password);
      // 2. Atualiza o AuthContext (chama /api/auth/me com o novo token)
      await checkAppState();
      // 3. Redireciona (o useEffect acima vai disparar quando isAuthenticated mudar)
      const next = searchParams.get('next') || '/';
      navigate(decodeURIComponent(next), { replace: true });
    } catch (err) {
      // Servidor inacessível — tentar restaurar sessão em cache pelo email
      if (api.auth.isNetworkError(err)) {
        const cached = api.auth.getCachedUser();
        if (cached && cached.email === email) {
          loginOffline(cached);
          const next = searchParams.get('next') || '/';
          navigate(decodeURIComponent(next), { replace: true });
          return;
        }
        setError('Servidor indisponível. Sem sessão em cache para este utilizador.');
      } else {
        setError(err.message || 'Email ou password incorretos');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-500 via-orange-700 to-slate-900 p-4">
      <Card className="w-full max-w-md shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 flex justify-center py-8">
          <img src="/images/Flashstore.png" alt="FlashStore" className="w-80 h-80 object-contain" />
        </div>
        <CardContent className="pt-6">
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="utilizador@flashstore.pt"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  A verificar...
                </>
              ) : 'Entrar'}
            </Button>
          </form>

          {/* Credenciais de desenvolvimento */}
          <div className="mt-6 p-3 bg-muted rounded-lg text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground mb-2">Credenciais de teste:</p>
            <p>Admin: <span className="font-mono">admin@flashstore.pt</span> / <span className="font-mono">123456</span></p>
            <p>Gerente: <span className="font-mono">gerente.braga@flashstore.pt</span> / <span className="font-mono">123456</span></p>
            <p>Caixa: <span className="font-mono">caixa1.braga@flashstore.pt</span> / <span className="font-mono">123456</span></p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
