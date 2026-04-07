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

// --- VINCULAR HUÉRFANO (USANDO BATCH PARA HACER TODO JUNTO) ---
window.linkHuerfano = async (idSafe, nombreHuerfano, stateCertificaciones) => {
    const emailDestino = document.getElementById(`m-e-${idSafe}`).value.toLowerCase().trim();
    if (!emailDestino.includes('@')) return alert("Email no válido");

    try {
        const batch = writeBatch(db);
        
        // 1. Crear el nuevo colaborador si no existe
        const userRef = doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'personas', emailDestino);
        batch.set(userRef, {
            nombre: nombreHuerfano,
            email: emailDestino,
            activo: true,
            area: "Sin definir",
            pais: "N/A"
        }, { merge: true });

        // 2. Buscar todos los certificados que le pertenecían al "Nombre" y pasarlos al "Email"
        const huerfanos = stateCertificaciones.filter(c => c.tempName === nombreHuerfano);
        huerfanos.forEach(c => {
            const certRef = doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'certificaciones', c.id);
            batch.update(certRef, { userEmail: emailDestino, tempName: null });
        });

        await batch.commit();
        alert("¡Vinculación completada con éxito!");
    } catch (e) {
        console.error("Error en la vinculación masiva:", e);
    }
};
