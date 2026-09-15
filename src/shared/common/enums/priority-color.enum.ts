
export enum PriorityColor {
  RED = 'RED',
  ORANGE = 'ORANGE',
  YELLOW = 'YELLOW',
  GREEN = 'GREEN',
  BLUE = 'BLUE',
}

export const PRIORITY_COLOR_SEVERITY: Record<PriorityColor, number> = {
  [PriorityColor.RED]: 0,
  [PriorityColor.ORANGE]: 1,
  [PriorityColor.YELLOW]: 2,
  [PriorityColor.GREEN]: 3,
  [PriorityColor.BLUE]: 4,
};
