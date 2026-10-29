// La ficha editable de una casa publicada (spec .scratch/editar-casa, maqueta 08a). Trozo diferido: se precarga con las
// pantallas del propietario. Por ahora solo el título; la pantalla llega en la tarea 9.
// Importa de react como lo harán las pantallas: un trozo que solo usa JSX parte el de jsx-runtime en dos y el JS
// inicial crece ~0,4 KB.
import { Fragment } from "react";

export function EditableFicha() {
  return (
    <Fragment>
      <h1>Editar la ficha</h1>
    </Fragment>
  );
}
