/**
 * js/data-processor.js
 * * Este archivo centraliza la lógica de procesamiento de archivos Excel
 * para las 4 fuentes de datos principales del sistema.
 */

import { db, firestoreAppId } from './firebase-config.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Mapeo de Site IDs de Cisco para identificar el país automáticamente
const CISCO_SITE_MAP = {
    '4070305': 'CHILE', '75181': 'CHILE',
    '1395635': 'PERÚ', '3401447': 'PERÚ',
    '3660181': 'COLOMBIA', '3987358': 'COLOMBIA'
};

/**
 * Convierte valores de fecha de Excel (números de serie o strings)
 * a formato estándar YYYY-MM-DD.
 */
export const parseExcelDate = (val) => {
    if (!val) return '1900-01-01';
    if (typeof val === 'number') {
        return new Date((val - 25569) * 86400000).toISOString().split('T')[0];
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? '1900-01-01' : d.toISOString().split('T')[0];
};

/**
 * 1. PROCESADOR: MAESTRO DE PERSONAS
 * Actualiza la base de datos de colaboradores oficiales.
 */
export const processPeople = async (data, updateUI, finishUI) => {
    let count = 0;
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const email = (row.eMail || row.Email || "").toLowerCase().trim();
        if (email) {
            await setDoc(doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'personas', email), {
                nombre: row.Nombre || row.nombre || "Desconocido",
                email: email,
                pais: (row.Pais || row.pais || "N/A").toUpperCase(),
                area: row.area || row.Area || "Sin definir",
                responsable: row['Responsable certificados'] || row.Responsable || "N/A",
                activo: true
            }, {
