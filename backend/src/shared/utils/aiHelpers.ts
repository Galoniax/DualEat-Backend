export const extractJSON = (text: string): any => {
  try {
    // 1. Si ya es un objeto, devolverlo
    if (typeof text === 'object') return text;

    // 2. Buscar el primer '{' y el último '}'
    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}');

    if (startIndex === -1 || endIndex === -1) return null;

    // 3. Cortar y parsear
    const jsonString = text.slice(startIndex, endIndex + 1);
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Error limpiando JSON de la IA:", error);
    return null;
  }
};