/**
 * Convierte el error de `supabase.functions.invoke` en uno legible.
 *
 * Cuando una Edge Function responde con un código que no es 2xx, supabase-js
 * devuelve `data = null` y lanza un FunctionsHttpError cuyo `message` es
 * siempre el mismo texto genérico: "Edge Function returned a non-2xx status
 * code". El motivo real —"ya existe un usuario con ese correo", "departamento no
 * permitido"...— viaja en el cuerpo de la respuesta, que queda en `context`.
 *
 * Sin leer ese cuerpo, la pantalla nunca puede decir qué falló aunque la función
 * lo haya explicado. Las funciones de este proyecto responden `{ error }`; se
 * acepta también `{ message }` por si alguna usa esa forma.
 */
export async function edgeFunctionError(error: unknown, fallback: string): Promise<Error> {
  const context = (error as { context?: Response } | null)?.context;
  try {
    const payload = await context?.clone?.().json();
    const reason = payload?.error || payload?.message;
    if (typeof reason === "string" && reason.trim()) return new Error(reason);
  } catch {
    // Cuerpo vacío o que no es JSON: se cae al mensaje genérico de abajo.
  }
  const message = (error as { message?: string } | null)?.message;
  return new Error(message || fallback);
}
