// Las pantallas de cada dato de una casa publicada (`/propietario/casas/$id/editar/$campo`). Trozo diferido. Por ahora
// solo el título; las pantallas llegan en las tareas 10 y 11.
// Importa de react como lo harán las pantallas: un trozo que solo usa JSX parte el de jsx-runtime en dos y el JS
// inicial crece ~0,4 KB.
import { Fragment } from "react";

export function EditarCampoScreen() {
  return (
    <Fragment>
      <h1>Editar un dato</h1>
    </Fragment>
  );
}
