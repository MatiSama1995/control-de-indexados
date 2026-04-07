import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, firestoreAppId } from './firebase-config.js';

const CISCO_SITE_MAP = {
    '4070305': 'CHILE', '75181': 'CHILE',
    '1395635': 'PERÚ', '3401447': 'PERÚ',
    '3660181': 'COLOMBIA', '3987358': 'COLOMBIA'
};

const parseExcelDate = (val) => {
    if (!val) return '1900-01-01';
    if (typeof val === 'number') {
        return new Date((val - 25569) * 86400000).toISOString().split('T')[0];
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? '1900-01-01' : d.toISOString().split('T')[0];
};

export const processPeople = async (data) => {
    for (const row of data) {
        const email = (row.eMail || row.Email || "").toLowerCase().trim();
        if (email) {
            const docRef = doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'personas', email);
            await setDoc(docRef, {
                nombre: row.Nombre || row.nombre || "Desconocido",
                email: email,
                pais: (row.Pais || row.pais || "N/A").toUpperCase(),
                area: row.area || row.Area || "N/A",
                responsable: row['Responsable certificados'] || row.Responsable || "N/A",
                activo: true
            }, { merge: true });
        }
    }
};

export const processCisco = async (data) => {
    const allowedSiteIds = Object.keys(CISCO_SITE_MAP);
    for (const row of data) {
        const siteId = String(row['Site Id'] || row['Site ID'] || "").trim();
        if (allowedSiteIds.includes(siteId)) {
            const email = (row.Email || "").toLowerCase().trim();
            if (email) {
                const id = Math.random().toString(36).substr(2, 9);
                await setDoc(doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'certificaciones', id), {
                    userEmail: email,
                    marca: "Cisco",
                    nombre: row.Certification || row.CertificationDescription || "Certificación Cisco",
                    vencimiento: parseExcelDate(row['Expiry Date']),
                    detectedCountry: CISCO_SITE_MAP[siteId]
                });
            }
        }
    }
};

export const processFortinet = async (data, statePersonas) => {
    let employeeKey = 'Partner Employee';
    let certKey = 'Certification';
    let expireKey = 'Expire Date';
    let countryKey = 'Billing Country';
    let startIndex = 0;
    
    for (let i = 0; i < Math.min(5, data.length); i++) {
        const values = Object.values(data[i]);
        if (values.includes('Partner Employee') || values.includes('Name')) {
            const entries = Object.entries(data[i]);
            for (const [key, value] of entries) {
                if (value === 'Partner Employee' || value === 'Name') employeeKey = key;
                if (value === 'Certification') certKey = key;
                if (value === 'Expire Date') expireKey = key;
                if (value === 'Billing Country' || value === 'Country') countryKey = key;
            }
            startIndex = i + 1;
            break;
        }
    }
    
    for (let i = startIndex; i < data.length; i++) {
        const row = data[i];
        const name = row[employeeKey] || row['Name'];
        if (name && typeof name === 'string' && name !== 'Partner Employee') {
            const p = statePersonas.find(per => per.nombre.toLowerCase().trim() === name.toLowerCase().trim());
            const email = p ? p.email : `huerfano_${name.replace(/\s+/g, '_')}`;
            const id = Math.random().toString(36).substr(2, 9);
            await setDoc(doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'certificaciones', id), {
                userEmail: email,
                tempName: p ? null : name,
                marca: "Fortinet",
                nombre: row[certKey] || "NSE Cert",
                vencimiento: parseExcelDate(row[expireKey]),
                detectedCountry: (row[countryKey] || 'N/A').toUpperCase()
            });
        }
    }
};

export const processGeneralCerts = async (data) => {
    for (const row of data) {
        const email = (row.Email || row.email || "").toLowerCase().trim();
        const nombreColab = row.Nombre || row.nombre || "Desconocido";
        
        if (email) {
            const docRef = doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'personas', email);
            await setDoc(docRef, {
                nombre: nombreColab,
                email: email,
                pais: (row.Pais || row.pais || "N/A").toUpperCase(),
                area: row.Area || row.area || "Sin definir",
                responsable: row['Responsable certificados'] || row.Responsable || "N/A",
                activo: true
            }, { merge: true });

            const certId = Math.random().toString(36).substr(2, 9);
            await setDoc(doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'certificaciones', certId), {
                userEmail: email,
                marca: row.Certificante || row.Marca || "General",
                nombre: row.Certificación || row.Certificacion || "Certificado",
                vencimiento: parseExcelDate(row['fecha vencimiento'] || row['Fecha Vencimiento']),
            });
        }
    }
};
