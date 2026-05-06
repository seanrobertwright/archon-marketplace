import { Request, Response } from 'express';
export declare const getWorkflows: (req: Request, res: Response) => Promise<void>;
export declare const getWorkflowById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const createWorkflow: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=workflow.d.ts.map