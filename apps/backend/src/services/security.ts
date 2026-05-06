import yaml from 'js-yaml';
import parseBash from 'bash-parser';

export interface SecurityResult {
  score: number;
  findings: SecurityFinding[];
}

export interface SecurityFinding {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  message: string;
  node?: string;
}

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

      // Calculate score based on findings
      for (const finding of findings) {
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

  private static inspectBashNode(nodeId: string, command: string, findings: SecurityFinding[]) {
    // Flag dangerous commands
    const dangerousCommands = ['rm', 'curl', 'wget', 'nc', 'netcat', 'bash', 'sh', 'eval'];
    
    try {
      const ast = parseBash(command);
      // Basic AST traversal (simplification for prototype)
      const stringifiedAst = JSON.stringify(ast);
      
      for (const cmd of dangerousCommands) {
        if (stringifiedAst.includes(`"name":"${cmd}"`) || command.includes(cmd)) {
          findings.push({ 
            severity: 'HIGH', 
            message: `Dangerous command detected in bash node: ${cmd}`,
            node: nodeId 
          });
        }
      }

      // Detect command injection (interpolation of external variables into bash)
      // Archon uses {{variable}} syntax
      if (/{{.*}}/.test(command)) {
        findings.push({
          severity: 'HIGH',
          message: 'Direct interpolation of variables into bash detected. Use arguments instead.',
          node: nodeId
        });
      }

    } catch (e) {
      // If bash-parser fails, fallback to regex
      findings.push({ severity: 'MEDIUM', message: 'Could not parse bash AST, security coverage may be reduced', node: nodeId });
    }
  }

  private static inspectPromptNode(nodeId: string, prompt: string, findings: SecurityFinding[]) {
    const riskyKeywords = ['ignore previous', 'system configuration', 'password', '.env', 'credentials'];
    for (const word of riskyKeywords) {
      if (prompt.toLowerCase().includes(word)) {
        findings.push({
          severity: 'MEDIUM',
          message: `Risky prompt instruction detected: "${word}"`,
          node: nodeId
        });
      }
    }
  }
}
