import { Controller, Get, Param } from '@nestjs/common';
import { CostTrackerService } from '../llm-gateway/cost-tracker.service';

@Controller('costs')
export class CostsController {
  constructor(private costTracker: CostTrackerService) {}

  @Get('summary')
  getSummary() {
    return this.costTracker.getSummary();
  }

  @Get('session/:id')
  getSessionCost(@Param('id') id: string) {
    return this.costTracker.getSessionCost(id);
  }
}
