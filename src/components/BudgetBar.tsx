import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Progress } from "./ui/progress";

export function BudgetBar() {
  const budget = useQuery(api.jobs.budget);
  if (!budget) return null;
  const pct = Math.min(100, (budget.usedSeconds / budget.totalSeconds) * 100);
  const leftMin = Math.max(
    0,
    Math.round((budget.totalSeconds - budget.usedSeconds) / 60),
  );
  return (
    <div className="px-2 py-2 space-y-1.5" data-testid="budget-bar">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>GPU today</span>
        <span>{leftMin} min left</span>
      </div>
      <Progress value={pct} className="h-1.5" />
      {budget.running > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {budget.running} render{budget.running > 1 ? "s" : ""} in progress
        </p>
      )}
    </div>
  );
}
