/** Reglas de validación del registro, las mismas del prototipo. */

export const MIN_AGE = 18;
export const MIN_PASSWORD = 8;

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** Edad en años cumplidos a partir de una fecha AAAA-MM-DD. Devuelve -1 si la fecha no es válida. */
export function ageFrom(isoDate: string, today: Date = new Date()): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return -1;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const birth = new Date(y, mo - 1, d);
  if (birth.getFullYear() !== y || birth.getMonth() !== mo - 1 || birth.getDate() !== d) return -1;
  if (birth > today) return -1;
  let age = today.getFullYear() - y;
  if (today.getMonth() < mo - 1 || (today.getMonth() === mo - 1 && today.getDate() < d)) age--;
  return age;
}

/** Convierte DD/MM/AAAA (como lo escribe la persona) a AAAA-MM-DD. */
export function dmyToIso(dmy: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dmy.trim());
  if (!m) return '';
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** Va poniendo las diagonales mientras se escribe la fecha: 0503 → 05/03. */
export function formatDmyInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export type SignupFields = {
  name: string;
  lastName: string;
  email: string;
  password: string;
  password2: string;
  birth: string; // DD/MM/AAAA
  zone: string;
  accepted: boolean;
};

export type SignupErrors = Partial<Record<keyof SignupFields, string>>;

export function validateSignup(f: SignupFields, today: Date = new Date()): SignupErrors {
  const e: SignupErrors = {};
  if (f.name.trim().length < 2) e.name = 'Escribe tu nombre.';
  if (f.lastName.trim().length < 2) e.lastName = 'Escribe tu apellido.';
  if (!isValidEmail(f.email)) e.email = 'Revisa tu correo, parece incompleto.';
  if (f.password.length < MIN_PASSWORD) e.password = `Usa al menos ${MIN_PASSWORD} caracteres.`;
  else if (!/\d/.test(f.password)) e.password = 'Agrega al menos un número.';
  if (!f.password2) e.password2 = 'Confirma tu contraseña.';
  else if (f.password2 !== f.password) e.password2 = 'Las contraseñas no coinciden. Revísalas.';
  const iso = dmyToIso(f.birth);
  const age = iso ? ageFrom(iso, today) : -1;
  if (!f.birth.trim()) e.birth = 'Escribe tu fecha de nacimiento.';
  else if (age < 0) e.birth = 'Escríbela como DD/MM/AAAA, por ejemplo 05/03/1995.';
  else if (age < MIN_AGE) e.birth = `Necesitas tener ${MIN_AGE} años o más para usar Dogder.`;
  if (f.zone.trim().length < 2) e.zone = 'Escribe tu colonia.';
  if (!f.accepted) e.accepted = 'Acepta los términos y las normas para continuar.';
  return e;
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const visible = user.length <= 2 ? user.slice(0, 1) : user.slice(0, 2);
  return `${visible}${'*'.repeat(Math.min(6, Math.max(1, user.length - visible.length)))}@${domain}`;
}
