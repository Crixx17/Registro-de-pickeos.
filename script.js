
document.addEventListener("DOMContentLoaded", () => {
    const campos = [
        "cambio",
        "orden",
        "linea",
        "pickeos",
        "column5",
        "column6",
        "column7",
        "column8"
    ];

    const formulario = document.getElementById("recordForm");
    const tabla = document.getElementById("tableBody");
    const mensajeVacio = document.getElementById("emptyMessage");
    const contador = document.getElementById("recordCount");
    const botonGuardar = document.getElementById("saveBtn");
    const botonCancelar = document.getElementById("cancelBtn");
    const botonLimpiar = document.getElementById("clearBtn");
    const mensaje = document.getElementById("status");
    const tituloFormulario = document.getElementById("formTitle");

    // Registros iniciales de ejemplo
    let registros = [
        {
            cambio: "",
            orden: "1574578",
            linea: "Zoon 2",
            pickeos: "184462",
            column5: "",
            column6: "",
            column7: "",
            column8: ""
        },
        {
            cambio: "",
            orden: "1574581",
            linea: "Megatron",
            pickeos: "184461",
            column5: "",
            column6: "",
            column7: "",
            column8: ""
        },
        {
            cambio: "",
            orden: "1574574",
            linea: "Octane 3",
            pickeos: "184471",
            column5: "",
            column6: "",
            column7: "",
            column8: ""
        }
    ];

    let indiceEdicion = null;

    // Obtener los datos introducidos en el formulario
    function obtenerDatos() {
        const datos = {};

        campos.forEach(campo => {
            datos[campo] = document
                .getElementById(campo)
                .value.trim();
        });

        return datos;
    }

    // Mostrar mensajes al usuario
    function mostrarMensaje(texto) {
        mensaje.textContent = texto;
    }

    // Dibujar todos los registros en la tabla
    function mostrarTabla() {
        tabla.replaceChildren();

        mensajeVacio.hidden = registros.length > 0;

        contador.textContent =
            `${registros.length} ${
                registros.length === 1 ? "registro" : "registros"
            }`;

        registros.forEach((registro, indice) => {
            const fila = document.createElement("tr");

            if (indice === indiceEdicion) {
                fila.classList.add("selected");
            }

            // Crear las celdas de información
            campos.forEach(campo => {
                const celda = document.createElement("td");
                celda.textContent = registro[campo] || "—";
                fila.appendChild(celda);
            });

            // Crear la celda de acciones
            const celdaAcciones = document.createElement("td");
            const contenedorBotones = document.createElement("div");

            contenedorBotones.className = "row-actions";

            const botonEditar = document.createElement("button");
            botonEditar.type = "button";
            botonEditar.className = "secondary mini";
            botonEditar.textContent = "Editar";

            botonEditar.addEventListener("click", () => {
                editarRegistro(indice);
            });

            const botonEliminar = document.createElement("button");
            botonEliminar.type = "button";
            botonEliminar.className = "danger mini";
            botonEliminar.textContent = "Eliminar";

            botonEliminar.addEventListener("click", () => {
                eliminarRegistro(indice);
            });

            contenedorBotones.append(
                botonEditar,
                botonEliminar
            );

            celdaAcciones.appendChild(contenedorBotones);
            fila.appendChild(celdaAcciones);
            tabla.appendChild(fila);
        });
    }

    // Agregar un registro nuevo o guardar una edición
    formulario.addEventListener("submit", evento => {
        evento.preventDefault();

        const datos = obtenerDatos();

        // Validar los campos obligatorios
        if (!datos.orden || !datos.linea || !datos.pickeos) {
            mostrarMensaje(
                "Completa los campos obligatorios: Orden, Línea y Pickeos."
            );
            return;
        }

        if (indiceEdicion === null) {
            registros.push(datos);

            mostrarMensaje(
                `La orden ${datos.orden} se agregó correctamente.`
            );
        } else {
            registros[indiceEdicion] = datos;

            mostrarMensaje(
                `La orden ${datos.orden} se actualizó correctamente.`
            );
        }

        cancelarEdicion();
        mostrarTabla();
    });

    // Cargar los datos de una fila para editarlos
    function editarRegistro(indice) {
        indiceEdicion = indice;

        const registro = registros[indice];

        campos.forEach(campo => {
            document.getElementById(campo).value =
                registro[campo] || "";
        });

        botonGuardar.textContent = "Guardar cambios";
        botonCancelar.hidden = false;
        tituloFormulario.textContent = "Editar registro";

        mostrarMensaje(`Editando la orden ${registro.orden}.`);
        mostrarTabla();

        document.getElementById("orden").focus();

        document.querySelector(".panel").scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    // Cancelar una edición y restablecer el formulario
    function cancelarEdicion() {
        indiceEdicion = null;

        formulario.reset();

        botonGuardar.textContent = "＋ Agregar registro";
        botonCancelar.hidden = true;
        tituloFormulario.textContent = "Datos del registro";

        mostrarTabla();
    }

    botonCancelar.addEventListener("click", () => {
        cancelarEdicion();
        mostrarMensaje("Edición cancelada.");
    });

    // Eliminar un registro individual
    function eliminarRegistro(indice) {
        const orden = registros[indice].orden;

        const confirmado = confirm(
            `¿Deseas eliminar el registro de la orden ${orden}?`
        );

        if (!confirmado) {
            return;
        }

        registros.splice(indice, 1);

        if (indiceEdicion === indice) {
            cancelarEdicion();
        } else if (
            indiceEdicion !== null &&
            indiceEdicion > indice
        ) {
            indiceEdicion--;
        }

        mostrarTabla();
        mostrarMensaje(`La orden ${orden} fue eliminada.`);
    }

    // Limpiar todos los registros de la tabla
    botonLimpiar.addEventListener("click", () => {
        if (registros.length === 0) {
            mostrarMensaje("La tabla ya está vacía.");
            return;
        }

        const confirmado = confirm(
            "¿Seguro que deseas eliminar todos los registros?"
        );

        if (!confirmado) {
            return;
        }

        registros = [];
        cancelarEdicion();
        mostrarMensaje("Todos los registros fueron eliminados.");
    });

    // Limpiar los campos sin modificar la tabla
    formulario.addEventListener("reset", () => {
        if (indiceEdicion !== null) {
            indiceEdicion = null;

            botonGuardar.textContent = "＋ Agregar registro";
            botonCancelar.hidden = true;
            tituloFormulario.textContent = "Datos del registro";

            mostrarTabla();
        }
    });

    // Mostrar la tabla al iniciar la página
    mostrarTabla();
});
