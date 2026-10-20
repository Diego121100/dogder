/** Traduce los errores de Supabase Auth a mensajes claros en español. */
export function authErrorMessage(err: { code?: string; message?: string; status?: number } | null | undefined): string {
  if (!err) return '';
  // En modo desarrollo, el error completo aparece en la Terminal para poder diagnosticarlo.
  if (__DEV__) console.warn('[Supabase Auth]', err.status ?? '', err.code ?? '', err.message ?? '');
  switch (err.code) {
    case 'user_already_exists':
    case 'email_exists':
      return 'Ya existe una cuenta con este correo. Inicia sesión.';
    case 'invalid_credentials':
      return 'El correo o la contraseña no coinciden. Inténtalo de nuevo.';
    case 'email_not_confirmed':
      return 'Todavía no verificas tu correo. Revisa tu bandeja de entrada.';
    case 'otp_expired':
      return 'Este código ya venció o no es correcto. Pide uno nuevo.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Hiciste demasiados intentos seguidos. Espera un momento y vuelve a intentarlo.';
    case 'weak_password':
      return 'Esa contraseña es muy fácil de adivinar. Elige otra.';
    case 'validation_failed':
      return 'Revisa los datos e inténtalo de nuevo.';
  }
  if (err.message && /sending.*email|email.*send|smtp/i.test(err.message)) {
    return 'No pudimos enviar el código a tu correo. Revisa que esté bien escrito e inténtalo de nuevo.';
  }
  if (err.message && /network|fetch/i.test(err.message)) {
    return 'No hay conexión a internet. Revisa tu conexión e inténtalo de nuevo.';
  }
  if (err.message && /Database error saving new user/i.test(err.message)) {
    // El servidor rechazó la cuenta (por ejemplo, por la edad).
    return 'No pudimos crear tu cuenta. Revisa que tengas 18 años o más e inténtalo de nuevo.';
  }
  return 'Algo salió mal. Inténtalo de nuevo en un momento.';
}
