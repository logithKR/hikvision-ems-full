const express = require('express');
const router = express.Router();
const container = require('../container');
const { authenticateToken, requireSystemAdmin } = require('../middleware');
const path = require('path');
const fs = require('fs');

const backupService = container.getBackupService();

/**
 * GET /api/system-admin/backups
 * List all backups
 */
router.get('/backups', authenticateToken, requireSystemAdmin, async (req, res) => {
    try {
        const backups = await backupService.getBackupHistory();
        res.json({ backups });
    } catch (error) {
        console.error('❌ Error getting backups:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/system-admin/backups
 * Create a new backup (async)
 */
router.post('/backups', authenticateToken, requireSystemAdmin, async (req, res) => {
    try {
        const actor = {
            uid: req.user.uid,
            name: req.user.name || 'System Admin',
            role: req.user.role,
            email: req.user.email
        };
        
        const metadata = await backupService.createBackup(actor);
        res.json({ message: 'Backup started', backup: metadata });
    } catch (error) {
        console.error('❌ Error creating backup:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/system-admin/backups/:id/status
 * Get status of a single backup
 */
router.get('/backups/:id/status', authenticateToken, requireSystemAdmin, async (req, res) => {
    try {
        const backup = await backupService.getBackupById(req.params.id);
        if (!backup) return res.status(404).json({ error: 'Backup not found' });
        res.json({ backup });
    } catch (error) {
        console.error('❌ Error checking backup status:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/system-admin/backups/:id/restore
 * Restore database from a backup
 */
router.post('/backups/:id/restore', authenticateToken, requireSystemAdmin, async (req, res) => {
    try {
        const { confirmationText } = req.body;
        if (confirmationText !== 'RESTORE') {
            return res.status(400).json({ error: 'Invalid confirmation text. Must be RESTORE.' });
        }

        const actor = {
            uid: req.user.uid,
            name: req.user.name || 'System Admin',
            role: req.user.role,
            email: req.user.email
        };

        await backupService.restoreFromBackup(req.params.id, actor);
        res.json({ message: 'Database restored successfully' });
    } catch (error) {
        console.error('❌ Error restoring backup:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/system-admin/backups/:id
 * Delete a backup
 */
router.delete('/backups/:id', authenticateToken, requireSystemAdmin, async (req, res) => {
    try {
        const actor = {
            uid: req.user.uid,
            name: req.user.name || 'System Admin',
            role: req.user.role
        };
        
        await backupService.deleteBackup(req.params.id, actor);
        res.json({ message: 'Backup deleted successfully' });
    } catch (error) {
        console.error('❌ Error deleting backup:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/system-admin/backups/:id/download
 * Download backup JSON file
 */
router.get('/backups/:id/download', authenticateToken, requireSystemAdmin, async (req, res) => {
    try {
        const backup = await backupService.getBackupById(req.params.id);
        if (!backup) return res.status(404).json({ error: 'Backup not found' });
        
        if (backup.status !== 'ready' || !backup.filePath || !fs.existsSync(backup.filePath)) {
            return res.status(400).json({ error: 'Backup file is not available' });
        }

        res.download(backup.filePath, `${backup.id}.json`);
    } catch (error) {
        console.error('❌ Error downloading backup:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
