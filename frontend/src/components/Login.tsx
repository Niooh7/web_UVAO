import React, { useState } from 'react';
import { User } from '../types';
import { Building2, Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User, token: string) => void;
}

function Login({ onLogin }: LoginProps) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });

      const data = await response.json();

      if (response.ok) {
        onLogin(data.user, data.access_token);
      } else {
        setError(data.detail || 'Неверный логин или пароль');
      }
    } catch (err) {
      setError('Ошибка при подключении к серверу');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Deep gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f0820] via-[#130d35] to-[#091830]" />

      {/* Animated orbs */}
      <div
        className="absolute top-1/4 -left-24 w-[480px] h-[480px] rounded-full blur-[100px] pointer-events-none animate-pulse-slow"
        style={{ background: 'radial-gradient(circle, rgba(109,40,217,0.35) 0%, transparent 70%)' }}
      />
      <div
        className="absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full blur-[100px] pointer-events-none animate-pulse-slow"
        style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.25) 0%, transparent 70%)', animationDelay: '2s' }}
      />
      <div
        className="absolute top-2/3 left-1/2 w-80 h-80 rounded-full blur-[80px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(79,70,229,0.2) 0%, transparent 70%)' }}
      />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
        }}
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-[420px] mx-4 animate-fade-in">
        <div
          className="rounded-3xl p-8 shadow-2xl"
          style={{
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(32px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <div
                className="absolute inset-0 rounded-2xl blur-xl"
                style={{ background: 'rgba(124,58,237,0.5)' }}
              />
              <div className="relative w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-700 rounded-2xl flex items-center justify-center shadow-lg">
                <Building2 className="w-10 h-10 text-white" />
              </div>
            </div>
            <h1 className="text-[22px] font-bold text-white text-center leading-tight">
              Информационная система
            </h1>
            <p className="text-white/40 text-xs mt-1.5 tracking-[0.15em] uppercase font-medium">
              Префектура ЮВАО
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-white/60 text-sm font-medium mb-2">Логин</label>
              <input
                id="login"
                type="text"
                value={login}
                onChange={e => setLogin(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
                className="w-full rounded-xl px-4 py-3 text-white placeholder:text-white/25 focus:outline-none transition-all duration-200 text-sm"
                onFocus={e => {
                  e.target.style.background = 'rgba(255,255,255,0.13)';
                  e.target.style.border = '1px solid rgba(139,92,246,0.5)';
                }}
                onBlur={e => {
                  e.target.style.background = 'rgba(255,255,255,0.08)';
                  e.target.style.border = '1px solid rgba(255,255,255,0.12)';
                }}
                placeholder="Введите логин"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-white/60 text-sm font-medium mb-2">Пароль</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                  className="w-full rounded-xl px-4 py-3 pr-12 text-white placeholder:text-white/25 focus:outline-none transition-all duration-200 text-sm"
                  onFocus={e => {
                    e.target.style.background = 'rgba(255,255,255,0.13)';
                    e.target.style.border = '1px solid rgba(139,92,246,0.5)';
                  }}
                  onBlur={e => {
                    e.target.style.background = 'rgba(255,255,255,0.08)';
                    e.target.style.border = '1px solid rgba(255,255,255,0.12)';
                  }}
                  placeholder="Введите пароль"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70 transition-colors p-1.5"
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="px-4 py-3 rounded-xl text-sm text-red-300"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)' }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-primary-500 to-primary-700 text-white font-semibold py-3 rounded-xl hover:from-primary-400 hover:to-primary-600 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-sm mt-1"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2.5">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Выполняется вход...
                </span>
              ) : 'Войти в систему'}
            </button>

            <p className="text-center text-white/30 text-xs pt-1">
              Нет аккаунта?{' '}
              <a
                href="https://web.tdm.mos.ru/user/3155016445519479"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-300/80 hover:text-primary-200 underline underline-offset-2 transition-colors"
              >
                Запросить регистрацию
              </a>
            </p>
          </form>
        </div>

        <p className="text-center text-white/20 text-[11px] mt-4 tracking-wide">
          Юго-Восточный административный округ г. Москвы
        </p>
      </div>
    </div>
  );
}

export default Login;
