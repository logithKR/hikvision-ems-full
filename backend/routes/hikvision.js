const express = require('express');
const router = express.Router();
const container = require('../container');
const db = container.db;

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

function getTimeString(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString("en-US", {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * Get date string in en-US locale (matches the way AttendanceRepository keys records).
 * Returns format like "3/8/2026".
 */
function getDateString(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US");
}

/**
 * Get ISO date string YYYY-MM-DD for use as part of the attendance doc ID.
 */
function getIsoDateString(isoString) {
    return new Date(isoString).toISOString().split('T')[0];
}

/**
 * Look up the EMS user by their hikvisionEmployeeId across all organizations.
 * Returns { uid, organizationId, name } or null if not found.
 */
async function findEmsUserByHikvisionId(hikvisionEmployeeId) {
    console.log(`🔍 Looking up EMS user for Hikvision ID: "${hikvisionEmployeeId}"`);

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
                console.log(`✅ Linked to EMS user: ${userData.name} (uid: ${userDoc.id}) in org: ${orgId}`);
                return {
                    uid: userDoc.id,
                    organizationId: orgId,
                    name: userData.name,
                };
            }
        }

        console.log(`⚠️ No active EMS user found for Hikvision ID: "${hikvisionEmployeeId}"`);
        return null;

    } catch (err) {
        console.error(`❌ Error looking up EMS user by Hikvision ID:`, err.message);
        return null;
    }
}

router.post('/', async (req, res) => {
    try {
        const contentType = req.headers['content-type'] || "";
        let payload = null;

        console.log(`📥 Received Hikvision Event. Content-Type: ${contentType}`);

        if (req.body && Object.keys(req.body).length > 0) {
            payload = req.body;
            console.log("✅ Body parsed by Express:", Object.keys(payload));
        } else {
            console.log("⚠️ Body empty or not parsed automatically.");
        }

        if (!payload && contentType.includes("multipart/form-data")) {
            console.log("⚠️ Multipart data received but not parsed.");
        }

        if (!payload || !payload.AccessControllerEvent) {
            console.log("⚠️ Missing AccessControllerEvent:", payload ? Object.keys(payload) : "none");
            return res.status(200).send("IGNORED");
        }

        const e = payload.AccessControllerEvent;
        const hikvisionEmployeeId = e.employeeNoString ?? null;
        const employeeName = e.name ?? null;
        const attendanceStatus = e.attendanceStatus ?? null;
        const verifyMode = getVerifyMode(e.subEventType);
        const scanTime = new Date().toISOString();

        if (!hikvisionEmployeeId || !attendanceStatus) {
            return res.status(200).send("IGNORED (NO EMPLOYEE DATA)");
        }

        const dateString = getDateString(scanTime);   // "3/8/2026"  — for display
        const isoDateString = getIsoDateString(scanTime); // "2026-03-08" — for doc ID
        const timeString = getTimeString(scanTime);

        console.log("🎯 Processing attendance:", { hikvisionEmployeeId, employeeName, attendanceStatus, verifyMode });

        // 1️⃣ SAVE RAW HIKVISION DATA (always, for audit)
        try {
            const logRef = await db.collection("hikvision_logs").add({
                hikvisionEmployeeId,
                employeeName,
                attendanceStatus,
                verifyMode,
                scanTime,
            });
            console.log("✅ Saved to hikvision_logs:", logRef.id);
        } catch (saveErr) {
            console.error("❌ Failed to save to hikvision_logs:", saveErr.message);
        }

        // 2️⃣ FIND THE LINKED EMS USER
        const emsUser = await findEmsUserByHikvisionId(hikvisionEmployeeId);

        if (!emsUser) {
            console.log(`⚠️ Hikvision ID "${hikvisionEmployeeId}" not linked — skipping attendance.`);
            return res.status(200).send("OK (UNLINKED)");
        }

        const { uid: userId, organizationId, name: userName } = emsUser;

        // 3️⃣ WRITE EMS ATTENDANCE using the same doc ID scheme as AttendanceRepository
        // Doc ID format: {userId}_{YYYY-MM-DD}
        const attendanceDocId = `${userId}_${isoDateString}`;
        const attendanceRef = db
            .collection('organizations')
            .doc(organizationId)
            .collection('attendance')
            .doc(attendanceDocId);

        const docSnap = await attendanceRef.get();
        const timestamp = new Date().toISOString();

        if (!docSnap.exists) {
            // Create brand new attendance record
            const newData = {
                id: attendanceDocId,
                userId,
                userName,
                date: isoDateString,
                organizationId,
                checkIn: attendanceStatus === "checkIn" ? timeString : null,
                checkOut: attendanceStatus === "checkOut" ? timeString : null,
                breakIn: attendanceStatus === "breakIn" ? timeString : null,
                breakOut: attendanceStatus === "breakOut" ? timeString : null,
                verifyMode,
                verifyMethod: verifyMode,
                source: 'hikvision',
                events: [{
                    type: attendanceStatus,
                    time: timestamp,
                    method: verifyMode,
                }],
                createdAt: timestamp,
                updatedAt: timestamp,
            };
            await attendanceRef.set(newData);
            console.log(`✅ NEW attendance record created: ${attendanceDocId} (${attendanceStatus})`);

        } else {
            // Update existing record — only set field if not already set (don't overwrite earlier checkIn, etc.)
            const existingData = docSnap.data();
            const events = existingData.events || [];
            events.push({ type: attendanceStatus, time: timestamp, method: verifyMode });

            const updateData = {
                updatedAt: timestamp,
                verifyMode,
                verifyMethod: verifyMode,
                source: 'hikvision',
                events,
            };

            // Only update the relevant time field if not already recorded
            if (attendanceStatus === "checkIn" && !existingData.checkIn) updateData.checkIn = timeString;
            if (attendanceStatus === "checkOut" && !existingData.checkOut) updateData.checkOut = timeString;
            if (attendanceStatus === "breakIn" && !existingData.breakIn) updateData.breakIn = timeString;
            if (attendanceStatus === "breakOut" && !existingData.breakOut) updateData.breakOut = timeString;

            await attendanceRef.update(updateData);
            console.log(`✅ UPDATED attendance record: ${attendanceDocId} (${attendanceStatus}) for ${userName}`);
        }

        return res.status(200).send("OK");

    } catch (err) {
        console.error("❌ Error:", err);
        return res.status(500).send("ERROR");
    }
});

router.get('/', (req, res) => {
    res.status(200).send("Hikvision Event API Running");
});

module.exports = router;
