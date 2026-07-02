import { Injectable, Logger } from '@nestjs/common';
import { TaskPlan, PlannedTask } from './task-planner.service';

export interface TaskNode {
  id: string;
  name: string;
  description: string;
  type: string;
  assignedAgentId: string;
  fallbackAgentId?: string;
  dependsOn: string[];
  input: {
    description: string;
    context?: Record<string, any>;
  };
  expectedOutput?: string;
}

export interface TaskGraph {
  nodes: TaskNode[];
  edges: { from: string; to: string }[];
  strategy: string;
}

@Injectable()
export class DAGBuilderService {
  private readonly logger = new Logger(DAGBuilderService.name);

  build(plan: TaskPlan): TaskGraph {
    const nodes: TaskNode[] = plan.tasks.map(task => ({
      id: task.id,
      name: task.name,
      description: task.description,
      type: task.type,
      assignedAgentId: task.assignedAgentId,
      dependsOn: task.dependsOn || [],
      input: task.input,
      expectedOutput: task.expectedOutput,
    }));

    // Build edges from dependencies
    const edges: { from: string; to: string }[] = [];
    for (const task of plan.tasks) {
      for (const dep of task.dependsOn || []) {
        edges.push({ from: dep, to: task.id });
      }
    }

    return {
      nodes,
      edges,
      strategy: plan.strategy,
    };
  }

  // Validate the DAG has no cycles
  validate(graph: TaskGraph): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = graph.nodes.find(n => n.id === nodeId);
      if (node) {
        for (const dep of node.dependsOn) {
          if (hasCycle(dep)) return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of graph.nodes) {
      if (hasCycle(node.id)) {
        this.logger.error(`Cycle detected involving node ${node.id}`);
        return false;
      }
    }

    return true;
  }
}
