import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { SecurityService } from '../services/security';
import axios from 'axios';

export const getWorkflows = async (req: Request, res: Response) => {
  try {
    const { search, status } = req.query;
    
    const workflows = await prisma.workflow.findMany({
      where: {
        AND: [
          search ? {
            OR: [
              { name: { contains: search as string, mode: 'insensitive' } },
              { description: { contains: search as string, mode: 'insensitive' } },
            ]
          } : {},
          status ? { status: status as any } : { status: 'PUBLISHED' }
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
};

export const getWorkflowById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch workflow' });
  }
};

export const createWorkflow = async (req: Request, res: Response) => {
  try {
    const { name, description, owner, repo, path } = req.body;
    const authorId = (req.user as any).id;
    
    // 1. Fetch the YAML content from GitHub first to analyze it
    const workflowPath = path || 'archon.yaml';
    const githubUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${workflowPath}`;
    
    let securityScore = 100;
    let securityReport: any = null;
    let status: any = 'QUARANTINED';

    try {
      const response = await axios.get(githubUrl);
      const yamlContent = response.data;
      
      // 2. Run Security Analysis
      const analysis = await SecurityService.analyzeWorkflow(yamlContent);
      securityScore = analysis.score;
      securityReport = analysis.findings;

      // 3. Determine status based on score
      if (securityScore >= 80) {
        status = 'PUBLISHED';
      } else if (securityScore < 50) {
        status = 'REJECTED';
      } else {
        status = 'QUARANTINED';
      }
    } catch (err: any) {
      // If we can't fetch it, we still create it but keep it quarantined
      console.error(`Failed to pre-analyze workflow: ${err.message}`);
    }

    const workflow = await prisma.workflow.create({
      data: {
        name,
        description,
        owner,
        repo,
        path: workflowPath,
        authorId,
        status,
        securityScore,
        securityReport: securityReport ? JSON.stringify(securityReport) : null
      }
    });
    
    res.status(201).json(workflow);
  } catch (error) {
    console.error('Create workflow error:', error);
    res.status(500).json({ error: 'Failed to create workflow' });
  }
};
