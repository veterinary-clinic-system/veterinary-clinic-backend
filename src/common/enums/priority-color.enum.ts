/**
 * The 5-color triage label, most to least severe. Matches diagram.jpg and
 * the table in prompt.md Section 6. Ordering below is used by
 * `PRIORITY_COLOR_SEVERITY` for sorting the triage queue.
 */
export enum PriorityColor {
  RED = 'RED',
  ORANGE = 'ORANGE',
  YELLOW = 'YELLOW',
  GREEN = 'GREEN',
  BLUE = 'BLUE',
}

/** Lower number = more severe. Use to sort/compare triage queues. */
export const PRIORITY_COLOR_SEVERITY: Record<PriorityColor, number> = {
  [PriorityColor.RED]: 0,
  [PriorityColor.ORANGE]: 1,
  [PriorityColor.YELLOW]: 2,
  [PriorityColor.GREEN]: 3,
  [PriorityColor.BLUE]: 4,
};
