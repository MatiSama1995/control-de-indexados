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
            }, { merge: true });
            count++;
        }
        updateUI(i + 1, data.length, `Colaborador: ${email}`);
    }
    finishUI(`Maestro actualizado: ${count} personas.`);
};

/**
 * 2. PROCESADOR: REPORTE CISCO
 * Filtra por Site IDs autorizados y registra certificaciones.
 */
export const processCisco = async (data, updateUI, finishUI) => {
    const allowedSiteIds = Object.keys(CISCO_SITE_MAP);
    let subidos = 0;
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const siteId = String(row['Site Id'] || row['Site ID'] || "").trim();
        const email = String(row['Email'] || "").toLowerCase().trim();
        
        if (allowedSiteIds.includes(siteId) && email) {
            const id = Math.random().toString(36).substr(2, 9);
            await setDoc(doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'certificaciones', id), {
                userEmail: email,
                marca: "Cisco",
                nombre: row['Certification Description'] || "CertInd",
                vencimiento: parseExcelDate(row['Expiry Date']),
                detectedCountry: CISCO_SITE_MAP[siteId]
            });
            subidos++;
            updateUI(i + 1, data.length, `✓ Cisco: ${email}`);
        } else {
            updateUI(i + 1, data.length, `⚠ Ignorado: Site ${siteId}`, false, true);
        }
    }
    finishUI(`Cisco finalizado: ${subidos} registros.`);
};

/**
 * 3. PROCESADOR: REPORTE FORTINET
 * Asocia certificaciones por nombre o crea registros huérfanos.
 */
export const processFortinet = async (data, updateUI, finishUI, personas) => {
    let subidos = 0;
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const name = row['Partner Employee'] || row['Name'];
        
        if (name && name !== 'Partner Employee') {
            const p = personas.find(per => per.nombre.toLowerCase().trim() === name.toLowerCase().trim());
            const email = p ? p.email : `huerfano_${name.replace(/\s+/g, '_')}`;
            const id = Math.random().toString(36).substr(2, 9);
            
            await setDoc(doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'certificaciones', id), {
                userEmail: email,
                tempName: p ? null : name,
                marca: "Fortinet",
                nombre: row['Certification'] || "NSE Cert",
                vencimiento: parseExcelDate(row['Expire Date']),
                detectedCountry: (row['Billing Country'] || 'N/A').toUpperCase()
            });
            subidos++;
            updateUI(i + 1, data.length, `✓ Fortinet: ${name}`);
        }
    }
    finishUI(`Fortinet finalizado: ${subidos} registros.`);
};

/**
 * 4. PROCESADOR: CARGA MASIVA GENERAL
 * Procesa la plantilla consolidada con todos los campos.
 */
export const processGeneralCerts = async (data, updateUI, finishUI) => {
    let subidos = 0;
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const email = (row.Email || row.email || "").toLowerCase().trim();
        
        if (email) {
            const id = Math.random().toString(36).substr(2, 9);
            await setDoc(doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'certificaciones', id), {
                userEmail: email,
                marca: row.Certificante || row.Marca || "General",
                nombre: row.Certificación || row.Certificacion || "Certificado",
                vencimiento: parseExcelDate(row['fecha vencimiento'] || row['Fecha Vencimiento']),
            });
            subidos++;
            updateUI(i + 1, data.length, `✓ General: ${email}`);
        }
    }
    finishUI(`Carga General finalizada: ${subidos} registros.`);
};
