import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GoalService } from './goal.service';
import { SavingsAdvisorService } from './savings-advisor.service';
import {
  CreateGoalDto,
  UpdateGoalDto,
  ContributeGoalDto,
  CalculatePlanDto,
  SavingsAdvisorSimulateDto,
} from './goal.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Smart Gold Savings Goals')
@Controller('goals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GoalController {
  constructor(
    private readonly goalService: GoalService,
    private readonly advisorService: SavingsAdvisorService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all active savings goals for the authenticated customer' })
  async getGoals(@CurrentUser('id') userId: string): Promise<any> {
    const data = await this.goalService.getGoals(userId);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('advisor/simulate')
  @ApiOperation({ summary: 'AI Gold Savings Advisor: Multi-scenario deterministic projection' })
  async simulateAdvisor(@Body() dto: SavingsAdvisorSimulateDto) {
    const data = await this.advisorService.simulate(dto);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id/recommendations')
  @ApiOperation({ summary: 'AI Gold Savings Advisor: Goal-specific trajectory recommendations' })
  async getGoalRecommendations(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    const data = await this.advisorService.getGoalRecommendations(userId, id);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new smart gold savings goal' })
  async createGoal(@CurrentUser('id') userId: string, @Body() dto: CreateGoalDto) {
    const data = await this.goalService.createGoal(userId, dto);
    return {
      success: true,
      message: 'Savings goal created successfully',
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('calculate')
  @ApiOperation({ summary: 'Simulate gold savings schedule and required periodic contributions' })
  async calculatePlan(@Body() dto: CalculatePlanDto) {
    const data = await this.goalService.calculateSavingsPlan(dto);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details and contribution history of a specific savings goal' })
  async getGoalById(@CurrentUser('id') userId: string, @Param('id') id: string) {
    const data = await this.goalService.getGoalById(userId, id);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update goal parameters, adjust target date, or pause/resume goal' })
  async updateGoal(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    const data = await this.goalService.updateGoal(userId, id, dto);
    return {
      success: true,
      message: 'Goal updated successfully',
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive a savings goal' })
  async deleteGoal(@CurrentUser('id') userId: string, @Param('id') id: string) {
    const result = await this.goalService.deleteGoal(userId, id);
    return {
      ...result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/contribute')
  @ApiOperation({ summary: 'Allocate gold savings or link completed order to a goal' })
  async contribute(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: ContributeGoalDto,
  ) {
    const data = await this.goalService.contributeToGoal(userId, id, dto);
    return {
      success: true,
      message: 'Contribution successfully recorded towards goal',
      data,
      timestamp: new Date().toISOString(),
    };
  }
}
