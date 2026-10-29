/** El SINV guarda 0 en productos que aún no tienen precio: se muestran como «Precio a cotizar». */
export const tienePrecio = (precio: number | null | undefined): precio is number => Number(precio) > 0;

export const formatoMXN = (precio: number) =>
  precio.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
