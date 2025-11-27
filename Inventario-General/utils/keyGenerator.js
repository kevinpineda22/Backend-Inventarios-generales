export const generateLocationKey = (bodega, zona, pasillo, ubicacion) => {
  // Genera una clave aleatoria de 6 caracteres (A-Z, 0-9)
  // Nota: Con 6 caracteres no podemos codificar toda la información de ubicación,
  // pero garantizamos una longitud corta y alta probabilidad de unicidad.
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};
