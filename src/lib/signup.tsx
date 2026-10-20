import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import type { SignupFields } from './validation';

/**
 * Guarda lo que la persona va llenando en el registro, para que al regresar
 * de un paso al anterior (por ejemplo, "¿Escribiste mal tu correo?") no se pierda nada.
 * La contraseña nunca se guarda aquí: solo vive en la pantalla del paso 1.
 */
export type SignupDraft = Omit<SignupFields, 'password' | 'password2'>;

const empty: SignupDraft = { name: '', lastName: '', email: '', birth: '', zone: '', accepted: false };

type Ctx = { draft: SignupDraft; setDraft: (d: SignupDraft) => void; reset: () => void };

const SignupContext = createContext<Ctx | null>(null);

export function SignupProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<SignupDraft>(empty);
  const value = useMemo(() => ({ draft, setDraft, reset: () => setDraft(empty) }), [draft]);
  return <SignupContext.Provider value={value}>{children}</SignupContext.Provider>;
}

export function useSignup(): Ctx {
  const ctx = useContext(SignupContext);
  if (!ctx) throw new Error('useSignup debe usarse dentro de SignupProvider');
  return ctx;
}
