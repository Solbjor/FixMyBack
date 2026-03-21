const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const { db } = require('../db');
const { postureSessions, postureMetrics, postureAlerts } = require('../db/migrations/schema');
const { eq } = require('drizzle-orm');

router.use(authenticate);

/**
 * POST /sessions/
 * Creates a new session for the currently logged in user.
 */
router.post('/', async (req, res) => {
    try{
        const [session] = await db
            .insert(postureSessions)
            .values({
                userId: req.user.uid
            })
            .returning();
        res.status(201).json(session);
    }
    catch (err) {
        console.error('Full error:', err);
        res.status(500).json({ error: err.message, detail: err.cause?.message });
    }
});

/**
 * PATCH /sessions/:id/end
 * Body : { overallScore, feedbackSummary }
 * Ends the given session. 
 */
router.patch('/:id/end', async (req, res)=> {
    const { overallScore, feedbackSummary } = req.body;

    try {
        const [session] = await db
            .update(postureSessions)
            .set({
                sessionEnd : new Date().toISOString(),
                overallScore,
                feedbackSummary,
            })
            .where(eq(postureSessions.sessionId, req.params.id))
            .returning();
        
        if(!session) return res.status(404).json({ error: 'Session not found'});

        res.status(200).json(session);
    }
    catch(err){
        res.status(500).json({ error: err.message});
    }
});

/**
 * GET /sessions/
 * Returns all sessions of current logged in user.
 */
router.get('/', async (req, res) => {
    try{
        const sessions = await db
            .select().from(postureSessions)
            .where(eq(postureSessions.userId, req.user.uid))
            .orderBy(postureSessions.sessionStart);
        res.status(200).json(sessions);
    }
    catch (err) { 
        res.status(500).json({error : err.message})
    }
});

/**
 * GET /sessions/:id
 * Params : { id }
 * Returns the given info, metrics, and alerts for the given session's id.
 */
router.get('/:id', async (req, res)=> {
    try{
        const [session] = await db
            .select().from(postureSessions)
            .where(eq(postureSessions.sessionId, req.params.id));
        
        if(!session) return res.status(404).json({error:'Session not found'});

        const metrics = await db
            .select().from(postureMetrics)
            .where(eq(postureMetrics.sessionId, req.params.id));
        
        const alerts = await db
            .select().from(postureAlerts)
            .where(eq(postureAlerts.sessionId, req.params.id));
        
            res.status(200).json({ ...session, metrics, alerts});
    }
    catch(err){
        res.status(500).json({error:err.message});
    }
});

/**
 * POST /sessions/:id/alerts
 * Params : { id }
 * Body : { alertType, severity, message }
 * Logs a new posture alert for the given session.
 */
router.post('/:id/alerts', async (req, res)=> {
    const { alertType, severity, message } = req.body;

    try{
        const [alert] = await db
            .insert(postureAlerts)
            .values({
                sessionId: req.params.id,
                alertType,
                severity,
                message,
            })
            .returning();
        res.status(201).json(alert);
    }
    catch(err){
        res.status(500).json({error: err.message});
    }
});

/**
 * POST /sessions/:id/metrics
 * Params : { id }
 * Body:{   neckAngleDeg,
            shoulderTiltDeg,
            hipTiltDeg,
            spineAlignmentScore,
            headForwardDistanceCm,
            leftRightBalanceScore,
            confidenceScore 
        }
 * Logs metrics metrics for the given session.
 */
router.post('/:id/metrics', async (req, res) => {
    const{
        neckAngleDeg,
        shoulderTiltDeg,
        hipTiltDeg,
        spineAlignmentScore,
        headForwardDistanceCm,
        leftRightBalanceScore,
        confidenceScore,
    } = req.body;

    try{
        const [metric] = await db
            .insert(postureMetrics)
            .values({
                sessionId: req.params.id,
                neckAngleDeg,
                shoulderTiltDeg,
                hipTiltDeg,
                spineAlignmentScore,
                headForwardDistanceCm,
                leftRightBalanceScore,
                confidenceScore,
            })
            .returning()

        res.status(201).json(metric);
    }
    catch(err){
        res.status(500).json({error: err.message});
    }
});

module.exports = router;