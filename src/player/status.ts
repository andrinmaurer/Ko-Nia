/** Energy and damage, following the MVP energy model in 17_MVP_SPECIFICATION.md. */
export const MAX_ENERGY = 500;
export const MAX_HEALTH = 3;
export const SCAN_COST = 15;

const WALK_COST_PER_METRE = 1 / 10;
const SPRINT_COST_PER_METRE = 1 / 5;
const SOLAR_IDLE = 1;
const SOLAR_MOVING = 0.3;
/** Minor damage slowly self-repairs; one point every this many seconds. */
const SELF_REPAIR_SECONDS = 60;

export class RobotStatus {
  energy = MAX_ENERGY;
  health = MAX_HEALTH;
  capacity = MAX_ENERGY;
  maxHealth = MAX_HEALTH;
  solarMultiplier = 1;
  configure(battery: boolean, durability: boolean, solar: boolean): void {
    const capacity = battery ? 750 : MAX_ENERGY;
    const health = durability ? 5 : MAX_HEALTH;
    this.energy = Math.min(capacity, this.energy + capacity - this.capacity);
    this.health = Math.min(health, this.health + health - this.maxHealth);
    this.capacity = capacity; this.maxHealth = health; this.solarMultiplier = solar ? 1.75 : 1;
  }
  private repairTimer = 0;

  get depleted(): boolean {
    return this.energy <= 0;
  }

  get disabled(): boolean {
    return this.health <= 0;
  }

  update(dt: number, metresMoved: number, sprinting: boolean, daylight: number): void {
    this.energy -= metresMoved * (sprinting ? SPRINT_COST_PER_METRE : WALK_COST_PER_METRE);
    const solar = metresMoved > 0.001 ? SOLAR_MOVING : SOLAR_IDLE;
    this.energy = clamp(this.energy + solar * this.solarMultiplier * daylight * dt, 0, this.capacity);

    if (this.health < this.maxHealth && this.health > 0) {
      this.repairTimer += dt;
      if (this.repairTimer >= SELF_REPAIR_SECONDS) {
        this.repairTimer = 0;
        this.health += 1;
      }
    }
  }

  trySpend(amount: number): boolean {
    if (this.energy < amount) return false;
    this.energy -= amount;
    return true;
  }

  damage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    this.repairTimer = 0;
  }

  restore(): void {
    this.energy = this.capacity;
    this.health = this.maxHealth;
    this.repairTimer = 0;
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
