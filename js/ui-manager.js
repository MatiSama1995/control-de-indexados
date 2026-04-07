import { db, firestoreAppId } from './firebase-config.js';
import { doc, deleteDoc, updateDoc, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- BORRAR UNA CERTIFICACIÓN ---
window.deleteCert = async (id) => {
    if (confirm("¿Estás seguro de eliminar este registro permanentemente?")) {
        try {
            await deleteDoc(doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'certificaciones', id));
            console.log("Registro eliminado:", id);
        } catch (e) {
            console.error("Error al borrar:", e);
        }
    }
};

// --- CAMBIAR ESTADO DE USUARIO (ACTIVO/INACTIVO) ---
window.toggleUserStatus = async (email, estadoActual) => {
    try {
        const userRef = doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'personas', email);
        await updateDoc(userRef, { activo: !estadoActual });
    } catch (e) {
        console.error("Error al actualizar usuario:", e);
    }
};

/**
 * VINCULAR HUÉRFANO
 * @param {string} idSafe - ID para identificar los elementos del DOM.
 * @param {string} originalKey - El identificador original (email o ID temporal) para buscar en el estado.
 * @param {Array} stateCertificaciones - El listado actual de certificaciones.
 */
window.linkHuerfano = async (idSafe, originalKey, stateCertificaciones) => {
    // Capturamos todos los valores desde los inputs editables
    const nuevoNombre = document.getElementById(`m-n-${idSafe}`).value.trim();
    const emailDestino = document.getElementById(`m-e-${idSafe}`).value.toLowerCase().trim();
    const paisDestino = document.getElementById(`m-p-${idSafe}`).value;
    const areaDestino = document.getElementById(`m-a-${idSafe}`).value;
    const responsableDestino = document.getElementById(`m-r-${idSafe}`).value;

    if (!nuevoNombre) return alert("El nombre no puede estar vacío");
    if (!emailDestino.includes('@')) return alert("Email no válido");

    try {
        const batch = writeBatch(db);
        
        // 1. Crear o actualizar el colaborador con los datos editados
        const userRef = doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'personas', emailDestino);
        batch.set(userRef, {
            nombre: nuevoNombre,
            email: emailDestino,
            activo: true,
            area: areaDestino || "Sin definir",
            pais: paisDestino || "N/A",
            responsable: responsableDestino || "N/A"
        }, { merge: true });

        // 2. Buscar todos los certificados vinculados a la 'originalKey' y pasarlos al nuevo email
        const registrosAfectados = stateCertificaciones.filter(c => 
            c.userEmail === originalKey || c.tempName === originalKey
        );

        registrosAfectados.forEach(c => {
            const certRef = doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'certificaciones', c.id);
            batch.update(certRef, { 
                userEmail: emailDestino, 
                tempName: null // Limpiamos el nombre temporal
            });
        });

        await batch.commit();
        alert("¡Vinculación completada con éxito!");
    } catch (e) {
        console.error("Error en la vinculación masiva:", e);
        alert("Error al procesar la vinculación");
    }
};
