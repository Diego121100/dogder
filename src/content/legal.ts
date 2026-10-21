/**
 * Textos legales de Dogder, los mismos del prototipo.
 * Lo que va entre [corchetes] es un dato por completar antes de publicar
 * (la app lo resalta en verde). Un abogado debe revisar estos textos.
 */

export type Block = string | { bullets: string[] };
export type Section = { title: string; body: Block[] };
export type LegalDoc = { title: string; lead: string; cards?: boolean; sections: Section[] };
export type LegalKey = 'normas' | 'terminos' | 'privacidad';

const CONTACTO = '[privacidad@dogder.app]';

export const LEGAL: Record<LegalKey, LegalDoc> = {
  normas: {
    title: 'Normas de la comunidad',
    lead: 'Estas normas aplican a todas las personas que usan Dogder. Nos ayudan a que la app sea un lugar seguro y respetuoso para los dueños y sus perros.',
    cards: true,
    sections: [
      { title: 'Salud del perro', body: ['Al registrarte declaras que tu perro cuenta con su cartilla de vacunación vigente, incluida la antirrábica, y con desparasitación al día.'] },
      { title: 'Tenencia responsable', body: ['El dueño responde por el comportamiento de su perro.'] },
      { title: 'Respeto', body: ['No se permite el acoso, el lenguaje ofensivo ni la discriminación hacia otros usuarios.'] },
      { title: 'Uso no comercial', body: ['Está prohibido ofrecer la venta, cruza o adopción con fines de lucro de animales.'] },
      { title: 'Información verídica', body: ['Los datos y fotos de tu perfil deben ser reales. Dogder podrá suspender las cuentas que incumplan estas normas.'] },
    ],
  },
  terminos: {
    title: 'Términos y Condiciones',
    lead: 'Estos términos regulan el uso de la aplicación Dogder. Léelos con atención: al crear una cuenta confirmas que los aceptas.',
    sections: [
      { title: 'Quiénes somos', body: ['Dogder es una aplicación operada por [Razón social], con domicilio en [Domicilio fiscal], que permite a dueños de perros conocer a otros dueños de su zona para que sus perros socialicen.'] },
      { title: 'Aceptación', body: ['Al crear una cuenta o usar Dogder aceptas estos Términos y Condiciones, el Aviso de Privacidad y las Normas de la comunidad. Si no estás de acuerdo con ellos, no debes usar la aplicación.'] },
      { title: 'Quién puede usar Dogder', body: ['Para usar Dogder debes tener al menos 18 años y capacidad legal para obligarte. Cada persona puede tener una sola cuenta, que es personal e intransferible.'] },
      { title: 'Tu cuenta', body: ['Te comprometes a proporcionar información verdadera y a mantenerla actualizada. Eres responsable de cuidar tu contraseña y de toda actividad que ocurra en tu cuenta. Si detectas un uso no autorizado, avísanos de inmediato.'] },
      {
        title: 'Uso permitido',
        body: [
          'Dogder está pensado para que los dueños se conozcan y organicen encuentros entre sus perros. No está permitido:',
          { bullets: [
            'Ofrecer la venta, cruza o adopción con fines de lucro de animales.',
            'Enviar publicidad, spam o mensajes masivos.',
            'Hacerte pasar por otra persona o crear perfiles falsos.',
            'Acosar, amenazar o discriminar a otros usuarios.',
            'Usar la aplicación con fines ilícitos.',
          ] },
        ],
      },
      { title: 'Contenido que publicas', body: ['Eres responsable de las fotos y textos que publiques y declaras que tienes derecho a usarlos. Nos otorgas una licencia gratuita y no exclusiva para mostrarlos dentro de la aplicación mientras tu cuenta esté activa. No se permite contenido violento, sexual, de maltrato animal o que infrinja derechos de terceros. Podemos retirar cualquier contenido que incumpla estos términos.'] },
      { title: 'Encuentros entre usuarios', body: ['Dogder no verifica la identidad ni los antecedentes de los usuarios, y no organiza ni supervisa los encuentros. Cada usuario decide con quién reunirse y es responsable de las reuniones que acuerde.'] },
      { title: 'Responsabilidad sobre tu perro', body: ['Como dueño, respondes por el comportamiento de tu perro y por los daños que pueda causar a personas, animales o bienes durante los encuentros. Declaras que tu perro tiene sus vacunas y desparasitación al día.'] },
      { title: 'Funciones de la aplicación', body: ['Algunas funciones tienen límites de uso, como el súper hueso, disponible una vez cada 24 horas. Podemos modificar, agregar o retirar funciones para mejorar el servicio.'] },
      { title: 'Suspensión y cancelación', body: ['Podemos suspender o cancelar cuentas que incumplan estos términos o las Normas de la comunidad. Tú puedes eliminar tu cuenta en cualquier momento desde la aplicación.'] },
      { title: 'Limitación de responsabilidad', body: ['Dogder se ofrece “tal como está”. En la medida permitida por la ley, no somos responsables por la conducta de los usuarios, por los daños que ocurran durante los encuentros ni por interrupciones temporales del servicio.'] },
      { title: 'Cambios a estos términos', body: ['Podemos actualizar estos términos. Te avisaremos dentro de la aplicación o por correo antes de que los cambios entren en vigor. Si sigues usando Dogder después de esa fecha, aceptas la nueva versión.'] },
      { title: 'Ley aplicable', body: ['Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Para cualquier controversia, las partes se someten a los tribunales competentes de la Ciudad de México, sin perjuicio de los derechos que te otorga la Ley Federal de Protección al Consumidor.'] },
      { title: 'Contacto', body: ['Para dudas sobre estos términos escríbenos a [contacto@dogder.app].'] },
    ],
  },
  privacidad: {
    title: 'Aviso de Privacidad',
    lead: 'Este aviso explica qué datos personales recabamos, para qué los usamos y cómo puedes ejercer tus derechos, conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.',
    sections: [
      { title: 'Responsable', body: [`[Razón social], con domicilio en [Domicilio], es responsable del tratamiento de tus datos personales. Para cualquier tema de privacidad puedes escribir a ${CONTACTO}.`] },
      {
        title: 'Datos que recabamos',
        body: [
          { bullets: [
            'Identificación y contacto: nombre, apellido, correo electrónico y fecha de nacimiento.',
            'Cuenta: contraseña, que guardamos cifrada.',
            'Ubicación aproximada: la ubicación de tu dispositivo, redondeada a unos 500 metros, y tu colonia.',
            'Perfil de tu perro: nombre, edad, sexo, raza, tamaño, nivel de energía, descripción y fotos.',
            'Uso de la app: me gusta, súper huesos, matches y mensajes del chat.',
            'Datos técnicos: tipo de dispositivo y sistema operativo.',
          ] },
          'No solicitamos datos personales sensibles. Te pedimos no incluirlos en tu perfil ni en los mensajes.',
        ],
      },
      {
        title: 'Finalidades necesarias',
        body: [
          'Usamos tus datos para:',
          { bullets: [
            'Crear y administrar tu cuenta, y verificar tu correo y tu edad.',
            'Mostrar tu perfil a otros usuarios y mostrarte perros cerca de ti con su distancia aproximada.',
            'Hacer funcionar los matches y el chat.',
            'Atender reportes, prevenir fraudes y proteger a la comunidad.',
            'Cumplir obligaciones legales.',
          ] },
          'Estas finalidades son indispensables para darte el servicio.',
          'Cuando alguien reporta a otro usuario, nuestro equipo de moderación puede revisar el perfil reportado y la conversación entre ambos, únicamente para resolver ese reporte. Fuera de esos casos, nadie del equipo lee tus mensajes.',
        ],
      },
      { title: 'Finalidades voluntarias', body: [`Si nos lo permites, también usaremos tus datos para enviarte novedades y promociones de Dogder, invitarte a encuestas y elaborar estadísticas para mejorar la aplicación. Puedes negarte en cualquier momento escribiendo a ${CONTACTO}. Negarte no afecta tu uso de Dogder.`] },
      { title: 'Tu ubicación', body: ['Nunca guardamos tu ubicación exacta: la redondeamos a unos 500 metros antes de almacenarla. Los demás usuarios solo ven una distancia aproximada, como “a 2 km”, y nunca tu dirección ni tus coordenadas.'] },
      { title: 'Qué ven otros usuarios', body: ['Otros usuarios pueden ver tu nombre (sin apellido), tu colonia, la distancia aproximada y el perfil y las fotos de tu perro. No ven tu apellido, tu correo, tu fecha de nacimiento ni tu ubicación exacta.'] },
      { title: 'Transferencias', body: ['No vendemos tus datos personales. Los compartimos únicamente con proveedores que nos ayudan a operar la aplicación, como servicios de almacenamiento en la nube, de envío de correos y de revisión automática de fotos para detectar contenido inapropiado, que los tratan por nuestra cuenta y bajo nuestras instrucciones. También podemos compartirlos con autoridades cuando una ley o una orden judicial lo exija.'] },
      { title: 'Derechos ARCO', body: [`Tienes derecho a acceder a tus datos, rectificarlos, cancelarlos u oponerte a su uso (derechos ARCO), así como a revocar tu consentimiento y limitar el uso de tus datos. El ejercicio de estos derechos es gratuito. Envía tu solicitud a ${CONTACTO} con tu nombre, el correo de tu cuenta y una descripción clara de lo que pides. Te responderemos dentro de los plazos que establece la ley.`] },
      { title: 'Eliminación de tu cuenta', body: ['Si eliminas tu cuenta, borraremos o anonimizaremos tus datos personales, salvo los que debamos conservar por una obligación legal y solo durante el tiempo que esta lo exija.'] },
      { title: 'Seguridad', body: ['Aplicamos medidas administrativas, técnicas y físicas para proteger tus datos contra daño, pérdida, alteración o acceso no autorizado.'] },
      { title: 'Tecnologías de almacenamiento', body: ['La aplicación guarda en tu dispositivo información necesaria para mantener tu sesión iniciada y recordar tus preferencias, como los filtros.'] },
      { title: 'Cambios a este aviso', body: ['Cualquier cambio a este aviso de privacidad te lo comunicaremos dentro de la aplicación o por correo electrónico.'] },
      { title: 'Autoridad', body: ['Si consideras que tu derecho a la protección de datos personales ha sido vulnerado, puedes acudir a la Secretaría Anticorrupción y Buen Gobierno, autoridad en la materia.'] },
    ],
  },
};

export function isLegalKey(k: unknown): k is LegalKey {
  return k === 'normas' || k === 'terminos' || k === 'privacidad';
}
