import { db, firestoreAppId } from './firebase-config.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const CISCO_SITE_MAP = {
    '4070305': 'CHILE', '75181': 'CHILE',
    '1395635': 'PERÚ', '3401447': 'PERÚ',
    '3660181': 'COLOMBIA', '3987358': 'COLOMBIA'
};

export const parseExcelDate = (val) => {
    if (!val) return '1900-01-01';
    if (typeof val === 'number') return new Date((val - 25569) * 86400000).toISOString().split('T')[0];
    const d = new Date(val);
    return isNaN(d.getTime()) ? '1900-01-01' : d.toISOString().split('T')[0];
};

export const processCisco = async (data, updateUI, finishUI) => {
    let subidos = 0;
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const siteId = String(row['Site Id'] || row['Site ID'] || "").trim();
        const email = String(row['Email'] || "").toLowerCase().trim();
        if (CISCO_SITE_MAP[siteId] && email) {
            const id = Math.random().toString(36).substr(2, 9);
            await setDoc(doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'certificaciones', id), {
                userEmail: email,
                marca: "Cisco",
                nombre: row['Certification Description'] || "Certificación",
                vencimiento: parseExcelDate(row['Expiry Date']),
                detectedCountry: CISCO_SITE_MAP[siteId]
            });
            subidos++;
        }
        updateUI(i + 1, data.length, `Procesando: ${email}`);
    }
    finishUI(`Cisco finalizado: ${subidos} registros.`);
};
