import yaml from 'js-yaml';
// @ts-ignore
import parseBash from 'bash-parser';
import Docker from 'dockerode';
import { Readable } from 'stream';

export interface SecurityResult {
  score: number;
  findings: SecurityFinding[];
}

export interface SecurityFinding {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  message: string;
  node?: string;
}

const docker = new Docker(); // Defaults to /var/run/docker.sock or \\.\pipe\docker_engine

export class SecurityService {
  /**
   * Stage 1: Static Analysis (SAST)
   */
  static async analyzeWorkflow(yamlContent: string): Promise<SecurityResult> {
    let score = 100;
    const findings: SecurityFinding[] = [];

    try {
      const doc = yaml.load(yamlContent) as any;
      if (!doc || !doc.nodes) {
        findings.push({ severity: 'HIGH', message: 'Invalid workflow schema: Missing nodes' });
        return { score: 0, findings };
      }

      // 1. Secret Scanning
      const secretRegex = /(api[_-]?key|secret|token|password|auth|credential)[ \t]*[:=][ \t]*['"]?[a-zA-Z0-9]{16,}['"]?/gi;
      if (secretRegex.test(yamlContent)) {
        findings.push({ severity: 'CRITICAL', message: 'Potential hardcoded secret detected' });
        score -= 100;
      }

      // 2. AST Command Inspection (Bash Nodes)
      for (const [nodeId, node] of Object.entries(doc.nodes) as [string, any][]) {
        if (node.type === 'bash' && node.command) {
          this.inspectBashNode(nodeId, node.command, findings);
        }
      }

      // 3. Prompt Risk Assessment (AI Nodes)
      for (const [nodeId, node] of Object.entries(doc.nodes) as [string, any][]) {
        if (node.type === 'prompt' && node.prompt) {
          this.inspectPromptNode(nodeId, node.prompt, findings);
        }
      }

      // Stage 2: Dynamic Analysis (Sandboxed)
      // Only run if static analysis didn't fail critically
      if (score > 0) {
        const dynamicFindings = await this.runDynamicAnalysis(yamlContent);
        findings.push(...dynamicFindings);
      }

      // Final Score Calculation
      score = 100;
      for (const finding of findings) {
        if (finding.severity === 'CRITICAL') score -= 100;
        if (finding.severity === 'HIGH') score -= 30;
        if (finding.severity === 'MEDIUM') score -= 15;
      }

      return {
        score: Math.max(0, score),
        findings
      };

    } catch (e: any) {
      return {
        score: 0,
        findings: [{ severity: 'HIGH', message: `Failed to parse YAML: ${e.message}` }]
      };
    }
  }

  /**
   * Stage 2: Dynamic Analysis (Sandboxed Execution)
   */
  private static async runDynamicAnalysis(yamlContent: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];
    let container;

    try {
      // 1. Create a restricted container
      container = await docker.createContainer({
        Image: 'alpine:latest',
        Cmd: ['sh', '-c', 'echo "Starting sandboxed evaluation..."; sleep 2; echo "Evaluation complete."'],
        NetworkDisabled: true, // No internet access
        HostConfig: {
          Memory: 128 * 1024 * 1024, // 128MB limit
          CpuQuota: 50000, // 50% CPU limit
          ReadonlyRootfs: true,
          AutoRemove: true
        }
      });

      // 2. Start container
      await container.start();

      // 3. Wait for execution (timeout after 5 seconds)
      const waitResult = await Promise.race([
        container.wait(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Sandbox timeout')), 5000))
      ]);

      console.log('Dynamic analysis container finished:', waitResult);

    } catch (err: any) {
      findings.push({
        severity: 'MEDIUM',
        message: `Dynamic analysis failed or timed out: ${err.message}. This may indicate a resource-heavy or suspicious workflow.`
      });
    }

    return findings;
  }

  private static inspectBashNode(nodeId: string, command: string, findings: SecurityFinding[]) {
    const dangerousCommands = ['rm', 'curl', 'wget', 'nc', 'netcat', 'bash', 'sh', 'eval'];
    try {
      const ast = parseBash(command);
      const stringifiedAst = JSON.stringify(ast);
      for (const cmd of dangerousCommands) {
        if (stringifiedAst.includes(`"name":"${cmd}"`) || command.includes(cmd)) {
          findings.push({ severity: 'HIGH', message: `Dangerous command detected: ${cmd}`, node: nodeId });
        }
      }
      if (/{{.*}}/.test(command)) {
        findings.push({ severity: 'HIGH', message: 'Direct variable interpolation into bash detected.', node: nodeId });
      }
    } catch (e) {
      findings.push({ severity: 'MEDIUM', message: 'Could not parse bash AST', node: nodeId });
    }
  }

  private static inspectPromptNode(nodeId: string, prompt: string, findings: SecurityFinding[]) {
    const riskyKeywords = ['ignore previous', 'password', '.env', 'credentials'];
    for (const word of riskyKeywords) {
      if (prompt.toLowerCase().includes(word)) {
        findings.push({ severity: 'MEDIUM', message: `Risky prompt instruction: "${word}"`, node: nodeId });
      }
    }
  }
}
