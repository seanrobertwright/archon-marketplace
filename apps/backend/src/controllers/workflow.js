import { Request, Response } from 'express';
import prisma from '../config/prisma';
export const getWorkflows = async (req, res) => {
    try {
        const { search, status } = req.query;
        const workflows = await prisma.workflow.findMany({
            where: {
                AND: [
                    search ? {
                        OR: [
                            { name: { contains: search, mode: 'insensitive' } },
                            { description: { contains: search, mode: 'insensitive' } },
                        ]
                    } : {},
                    status ? { status: status } : { status: 'PUBLISHED' }
                ]
            },
            include: {
                author: {
                    select: { username: true, avatarUrl: true }
                },
                _count: {
                    select: { stars: true }
                }
            },
            orderBy: {
                installCount: 'desc'
            }
        });
        res.json(workflows);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch workflows' });
    }
};
export const getWorkflowById = async (req, res) => {
    try {
        const { id } = req.params;
        const workflow = await prisma.workflow.findUnique({
            where: { id },
            include: {
                author: {
                    select: { username: true, avatarUrl: true }
                },
                _count: {
                    select: { stars: true }
                }
            }
        });
        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }
        res.json(workflow);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch workflow' });
    }
};
export const createWorkflow = async (req, res) => {
    try {
        const { name, description, owner, repo, path } = req.body;
        const authorId = req.user.id;
        const workflow = await prisma.workflow.create({
            data: {
                name,
                description,
                owner,
                repo,
                path: path || 'archon.yaml',
                authorId,
                status: 'QUARANTINED', // New submissions start in quarantine
                securityScore: 100
            }
        });
        res.status(201).json(workflow);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create workflow' });
    }
};
//# sourceMappingURL=workflow.js.map