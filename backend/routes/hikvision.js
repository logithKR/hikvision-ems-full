const express = require('express');
const router = express.Router();
const container = require('../container');
const db = container.db;
const multer = require('multer');
const upload = multer();

// No rate limiter — smart state machine in Firestore handles duplicate protection.

// Helper functions
function getVerifyMode(code) {
    const map = {
        38: "Fingerprint",
        75: "Face",
        76: "Face",
        1: "Card",
        25: "Card",
        10: "Card",
    };
    return map[code] || "Unknown";
}

// IST timezone — always use this regardless of where the server is hosted
const IST = 'Asia/Kolkata';

function getTimeString(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString("en-US", {
        timeZone: IST,
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * Get date string YYYY-MM-DD in IST, for use as part of the attendance doc ID.
 */
function getIsoDateString(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-CA', { timeZone: IST }); // 'en-CA' gives YYYY-MM-DD
}

/**
 * Get display date string in en-US locale.
 */
function getDateString(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", { timeZone: IST });
}

/**
 * Look up the EMS user by their hikvisionEmployeeId across all organizations.
 * Returns { uid, organizationId, name } or null if not found.
 */
async function findEmsUserByHikvisionId(hikvisionEmployeeId) {
    try {
        const orgsSnapshot = await db.collection('organizations').get();

        for (const orgDoc of orgsSnapshot.docs) {
            const orgId = orgDoc.id;

            const userQuery = await db
                .collection('organizations')
                .doc(orgId)
                .collection('users')
                .where('hikvisionEmployeeId', '==', hikvisionEmployeeId)
                .where('isActive', '==', true)
                .limit(1)
                .get();

            if (!userQuery.empty) {
                const userDoc = userQuery.docs[0];
                const userData = userDoc.data();
                return {
                    uid: userDoc.id,
                    organizationId: orgId,
                    name: userData.name,
                };
            }
        }

        return null;

    } catch (err) {
        console.error(`❌ Hikvision: Error looking up user by ID "${hikvisionEmployeeId}":`, err.message);
        return null;
    }
}

router.post('/', upload.any(), async (req, res) => {
    try {
        const contentType = req.headers['content-type'] || "";
        let payload = null;

        // Handle raw JSON body
        if (req.body && Object.keys(req.body).length > 0 && !contentType.includes("multipart")) {
            payload = req.body;
        }

        // Handle Multipart Form Data
        if (contentType.includes("multipart/form-data")) {
            if (req.body.event_log) {
                try { payload = JSON.parse(req.body.event_log); } catch (e) { }
            } else if (req.body.AccessControllerEvent) {
                try {
                    payload = { AccessControllerEvent: JSON.parse(req.body.AccessControllerEvent) };
                } catch (e) {
                    payload = req.body;
                }
            }

            if (!payload && req.files && req.files.length > 0) {
                const jsonFile = req.files.find(f => f.mimetype === 'application/json' || f.originalname.endsWith('.json'));
                if (jsonFile) {
                    try { payload = JSON.parse(jsonFile.buffer.toString('utf-8')); } catch (e) { }
                }
            }
        }

        const HIKVISION_SUCCESS = { "statusCode": 1, "statusString": "OK", "subStatusCode": "OK", "errorCode": 0 };

        // Silently ack heartbeats / status checks with no event payload
        if (!payload || !payload.AccessControllerEvent) {
            return res.status(200).json(HIKVISION_SUCCESS);
        }

        const e = payload.AccessControllerEvent;
        const hikvisionEmployeeId = e.employeeNoString ?? null;
        const employeeName = e.name ?? null;

        let attendanceStatus = e.attendanceStatus ?? "checkIn";
        if (attendanceStatus === "undefined") attendanceStatus = "checkIn";

        const verifyMode = getVerifyMode(e.subEventType);

        // Use the actual scan time from the device, not the server receive time
        const dt = e.time || e.dateTime || e.activeTime || payload.dateTime || new Date().toISOString();
        const scanTime = new Date(dt).toISOString();

        // --- 1. LIVE DATA ONLY — drop anything older than 5 minutes ---
        if (dt) {
            const eventAgeMinutes = (Date.now() - new Date(dt).getTime()) / 1000 / 60;
            if (eventAgeMinutes > 5 || eventAgeMinutes < -5) {
                return res.status(200).json(HIKVISION_SUCCESS);
            }
        }

        // --- 2. Must have an employee ID ---
        if (!hikvisionEmployeeId) {
            return res.status(200).json(HIKVISION_SUCCESS);
        }

        const dateString = getDateString(scanTime);
        const isoDateString = getIsoDateString(scanTime);
        const timeString = getTimeString(scanTime);

        // 1️⃣ FIND THE LINKED EMS USER
        const emsUser = await findEmsUserByHikvisionId(hikvisionEmployeeId);

        if (!emsUser) {
            try {
                await db.collection("hikvision_logs").add({
                    hikvisionEmployeeId,
                    employeeName,
                    deviceSaid: attendanceStatus,
                    systemAction: 'ignored',
                    reason: 'Hikvision ID not linked to any EMS user',
                    verifyMode,
                    scanTime,
                    createdAt: new Date().toISOString(),
                });
            } catch (e) { /* non-critical */ }
            console.warn(`⚠️ Hikvision scan ignored — ID "${hikvisionEmployeeId}" not linked to any user.`);
            return res.status(200).json(HIKVISION_SUCCESS);
        }

        const { uid: userId, organizationId, name: userName } = emsUser;

        // 2️⃣ READ CURRENT ATTENDANCE STATE from Firestore (the ground truth)
        const attendanceDocId = `${userId}_${isoDateString}`;
        const attendanceRef = db
            .collection('organizations')
            .doc(organizationId)
            .collection('attendance')
            .doc(attendanceDocId);

        const docSnap = await attendanceRef.get();
        const timestamp = new Date().toISOString();

        // 3️⃣ SMART STATE MACHINE — Hikvision device = checkIn ONLY
        // CheckOut can ONLY happen through the app.
        let systemAction;
        let reason;

        if (!docSnap.exists) {
            systemAction = 'checkIn';
            reason = 'First scan of the day';
        } else {
            const existing = docSnap.data();
            if (existing.checkIn) {
                systemAction = 'logged_only';
                reason = existing.checkOut
                    ? 'Day already complete — device scans after checkout are logged only'
                    : 'Already checked in — use the app to check out';
            } else {
                systemAction = 'checkIn';
                reason = 'No checkIn on existing record — recording as checkIn';
            }
        }

        // 4️⃣ SAVE RAW SCAN TO AUDIT LOG (always)
        try {
            await db.collection("hikvision_logs").add({
                hikvisionEmployeeId,
                employeeName,
                emsUserId: userId,
                orgId: organizationId,
                deviceSaid: attendanceStatus,
                systemAction,
                reason,
                verifyMode,
                scanTime,
                createdAt: timestamp,
            });
        } catch (saveErr) {
            console.error("❌ Hikvision: Failed to write audit log:", saveErr.message);
        }

        // 5️⃣ APPLY THE DECISION
        if (systemAction === 'logged_only') {
            console.log(`📝 [Hikvision] ${userName} — ${reason}`);
            return res.status(200).json(HIKVISION_SUCCESS);
        }

        if (!docSnap.exists) {
            // Create brand-new attendance record (checkIn)
            const HIKVISION_LOCATION = 'In Office (Hikvision Device)';
            await attendanceRef.set({
                id: attendanceDocId,
                userId,
                userName,
                date: isoDateString,
                organizationId,
                checkIn: timeString,
                checkOut: null,
                breakIn: null,
                breakOut: null,
                checkInLocation: HIKVISION_LOCATION,
                verifyMode,
                verifyMethod: verifyMode,
                source: 'hikvision',
                events: [{ type: systemAction, time: timestamp, method: verifyMode, location: HIKVISION_LOCATION }],
                createdAt: timestamp,
                updatedAt: timestamp,
            });
            console.log(`✅ [Hikvision] checkIn — ${userName} at ${timeString} on ${dateString}`);

        } else {
            // Update existing record (edge case — currently device can't write checkOut)
            const existingData = docSnap.data();
            const events = existingData.events || [];
            events.push({ type: systemAction, time: timestamp, method: verifyMode });
            await attendanceRef.update({
                checkOut: timeString,
                updatedAt: timestamp,
                verifyMode,
                verifyMethod: verifyMode,
                source: 'hikvision',
                events,
            });
            console.log(`✅ [Hikvision] checkOut — ${userName} at ${timeString} on ${dateString}`);
        }

        return res.status(200).json(HIKVISION_SUCCESS);

    } catch (err) {
        console.error("❌ [Hikvision] Unhandled error:", err.message);
        return res.status(500).json({ success: false, error: "ERROR" });
    }
});

router.get('/', (req, res) => {
    res.status(200).send("Hikvision Event API Running");
});

module.exports = router;
