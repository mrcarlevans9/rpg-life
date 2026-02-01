/**
 * Client-side Battle Engine for Async PvP
 * Runs entirely on the client - no server needed
 */

const MAX_TURNS = 50;
const CRIT_MULTIPLIER = 1.5;
const VARIANCE = 0.1; // ±10% damage variance

/**
 * Convert snapshot to fighter format
 */
function snapshotToFighter(snapshot, isChallenger = false) {
  return {
    id: snapshot.user_id,
    name: snapshot.username || 'Unknown',
    isChallenger,

    // Stats
    maxHp: snapshot.max_hp || 100,
    currentHp: snapshot.max_hp || 100,
    attack: snapshot.attack || 10,
    defense: snapshot.defense || 5,
    speed: snapshot.speed || 10,
    critChance: snapshot.crit_chance || 10,

    // Abilities
    spells: snapshot.custom_spells || [],

    // Combat state
    isDefending: false,
    currentMp: 50, // Base mana

    // For reference
    level: snapshot.level || 1
  };
}

/**
 * Calculate damage with variance and crit
 */
function calculateDamage(attacker, defender, isPowerAttack = false) {
  // Base damage formula: attack - defense/2, minimum 1
  let baseDamage = Math.max(1, attacker.attack - Math.floor(defender.defense / 2));

  // Power attack deals 1.5x damage
  if (isPowerAttack) {
    baseDamage = Math.floor(baseDamage * 1.5);
  }

  // Apply variance (±10%)
  const variance = 1 + (Math.random() * VARIANCE * 2 - VARIANCE);
  let damage = Math.floor(baseDamage * variance);

  // Check for critical hit
  const isCrit = Math.random() * 100 < attacker.critChance;
  if (isCrit) {
    damage = Math.floor(damage * CRIT_MULTIPLIER);
  }

  // Defender blocking reduces damage by 50%
  if (defender.isDefending) {
    damage = Math.floor(damage * 0.5);
  }

  return {
    damage: Math.max(1, damage),
    isCrit,
    wasBlocked: defender.isDefending
  };
}

/**
 * AI decision making for opponent
 */
function getAIAction(fighter) {
  const hpPercent = fighter.currentHp / fighter.maxHp;

  // Check if has heal spell and low HP
  const healSpell = fighter.spells.find(s => s.name?.toLowerCase().includes('heal'));
  if (healSpell && hpPercent < 0.3 && Math.random() < 0.6) {
    return { type: 'heal', spell: healSpell };
  }

  // Check if has power attack spell
  const powerSpell = fighter.spells.find(s =>
    s.damage && s.damage > 20 && fighter.currentMp >= (s.manaCost || 10)
  );
  if (powerSpell && Math.random() < 0.2) {
    return { type: 'spell', spell: powerSpell };
  }

  // Defend if very low HP
  if (hpPercent < 0.2 && Math.random() < 0.4) {
    return { type: 'defend' };
  }

  // Default: basic attack
  return { type: 'attack' };
}

/**
 * Execute a single turn
 */
function executeTurn(attacker, defender, action) {
  const turnResult = {
    attacker: attacker.name,
    defender: defender.name,
    action: action.type,
    damage: 0,
    healing: 0,
    isCrit: false,
    wasBlocked: false,
    attackerHp: attacker.currentHp,
    defenderHp: defender.currentHp,
    message: ''
  };

  // Reset defender's blocking state
  defender.isDefending = false;

  switch (action.type) {
    case 'attack': {
      const result = calculateDamage(attacker, defender);
      defender.currentHp = Math.max(0, defender.currentHp - result.damage);
      turnResult.damage = result.damage;
      turnResult.isCrit = result.isCrit;
      turnResult.wasBlocked = result.wasBlocked;
      turnResult.defenderHp = defender.currentHp;

      let msg = `${attacker.name} attacks for ${result.damage} damage`;
      if (result.isCrit) msg += ' (CRITICAL!)';
      if (result.wasBlocked) msg += ' (blocked)';
      turnResult.message = msg;
      break;
    }

    case 'power_attack': {
      const result = calculateDamage(attacker, defender, true);
      defender.currentHp = Math.max(0, defender.currentHp - result.damage);
      turnResult.damage = result.damage;
      turnResult.isCrit = result.isCrit;
      turnResult.wasBlocked = result.wasBlocked;
      turnResult.defenderHp = defender.currentHp;

      let msg = `${attacker.name} uses POWER ATTACK for ${result.damage} damage`;
      if (result.isCrit) msg += ' (CRITICAL!)';
      if (result.wasBlocked) msg += ' (blocked)';
      turnResult.message = msg;
      break;
    }

    case 'defend': {
      attacker.isDefending = true;
      turnResult.message = `${attacker.name} takes a defensive stance`;
      break;
    }

    case 'spell': {
      const spell = action.spell;
      if (spell.damage) {
        // Offensive spell
        const spellDamage = spell.damage;
        defender.currentHp = Math.max(0, defender.currentHp - spellDamage);
        attacker.currentMp = Math.max(0, attacker.currentMp - (spell.manaCost || 10));
        turnResult.damage = spellDamage;
        turnResult.defenderHp = defender.currentHp;
        turnResult.message = `${attacker.name} casts ${spell.name} for ${spellDamage} damage!`;
      }
      break;
    }

    case 'heal': {
      const spell = action.spell;
      const healAmount = spell.healing || 30;
      const actualHeal = Math.min(healAmount, attacker.maxHp - attacker.currentHp);
      attacker.currentHp += actualHeal;
      attacker.currentMp = Math.max(0, attacker.currentMp - (spell.manaCost || 15));
      turnResult.healing = actualHeal;
      turnResult.attackerHp = attacker.currentHp;
      turnResult.message = `${attacker.name} heals for ${actualHeal} HP`;
      break;
    }
  }

  return turnResult;
}

/**
 * Calculate rewards based on battle outcome
 */
function calculateRewards(winner, loser, challenger, isDraw) {
  const baseXp = 50;
  const baseGold = 25;

  if (isDraw) {
    return { xp: Math.floor(baseXp * 0.5), gold: 0 };
  }

  const isWinner = winner.id === challenger.id;
  const levelDiff = loser.level - winner.level;
  const multiplier = Math.max(0.5, 1 + (levelDiff * 0.1));

  if (isWinner) {
    return {
      xp: Math.floor(baseXp * multiplier),
      gold: Math.floor(baseGold * multiplier)
    };
  } else {
    // Loser gets 25% XP, no gold
    return {
      xp: Math.floor(baseXp * 0.25),
      gold: 0
    };
  }
}

/**
 * Main Battle Engine Class
 */
export class BattleEngine {
  constructor(challengerSnapshot, opponentSnapshot) {
    this.challenger = snapshotToFighter(challengerSnapshot, true);
    this.opponent = snapshotToFighter(opponentSnapshot, false);
    this.battleLog = [];
    this.currentTurn = 0;
    this.isComplete = false;
    this.winner = null;
    this.isDraw = false;

    // Store original snapshots for recording
    this.challengerSnapshot = challengerSnapshot;
    this.opponentSnapshot = opponentSnapshot;
  }

  /**
   * Determine turn order based on speed
   */
  getTurnOrder() {
    if (this.challenger.speed > this.opponent.speed) {
      return [this.challenger, this.opponent];
    } else if (this.opponent.speed > this.challenger.speed) {
      return [this.opponent, this.challenger];
    } else {
      // Same speed - random
      return Math.random() < 0.5
        ? [this.challenger, this.opponent]
        : [this.opponent, this.challenger];
    }
  }

  /**
   * Execute a full round (both fighters act)
   */
  executeRound(challengerAction = null) {
    if (this.isComplete) return null;

    const [first, second] = this.getTurnOrder();

    // First fighter acts
    const firstAction = first.isChallenger
      ? (challengerAction || { type: 'attack' })
      : getAIAction(first);

    const firstResult = executeTurn(first, second, firstAction);
    this.battleLog.push(firstResult);

    // Check if battle ended
    if (second.currentHp <= 0) {
      this.endBattle(first);
      return this.getResult();
    }

    // Second fighter acts
    const secondAction = second.isChallenger
      ? (challengerAction || { type: 'attack' })
      : getAIAction(second);

    const secondResult = executeTurn(second, first, secondAction);
    this.battleLog.push(secondResult);

    // Check if battle ended
    if (first.currentHp <= 0) {
      this.endBattle(second);
      return this.getResult();
    }

    this.currentTurn++;

    // Check for turn limit (draw)
    if (this.currentTurn >= MAX_TURNS) {
      this.endBattle(null); // Draw
      return this.getResult();
    }

    return null; // Battle continues
  }

  /**
   * Run full auto-battle
   */
  runBattle() {
    while (!this.isComplete) {
      this.executeRound();
    }
    return this.getResult();
  }

  /**
   * For interactive mode - execute player's turn
   */
  executePlayerTurn(action) {
    if (this.isComplete) return this.getResult();
    return this.executeRound(action);
  }

  /**
   * End the battle
   */
  endBattle(winner) {
    this.isComplete = true;
    this.winner = winner;
    this.isDraw = winner === null;
  }

  /**
   * Get battle result
   */
  getResult() {
    const rewards = this.winner
      ? calculateRewards(this.winner, this.winner === this.challenger ? this.opponent : this.challenger, this.challenger, this.isDraw)
      : { xp: Math.floor(25), gold: 0 }; // Draw rewards

    return {
      won: this.winner?.isChallenger || false,
      winnerId: this.winner?.id || null,
      isDraw: this.isDraw,
      xpReward: rewards.xp,
      goldReward: rewards.gold,
      battleLog: this.battleLog,
      totalTurns: this.currentTurn,
      challengerSnapshot: this.challengerSnapshot,
      opponentSnapshot: this.opponentSnapshot,
      finalState: {
        challenger: {
          hp: this.challenger.currentHp,
          maxHp: this.challenger.maxHp
        },
        opponent: {
          hp: this.opponent.currentHp,
          maxHp: this.opponent.maxHp
        }
      }
    };
  }

  /**
   * Get current battle state (for UI updates)
   */
  getState() {
    return {
      challenger: {
        name: this.challenger.name,
        hp: this.challenger.currentHp,
        maxHp: this.challenger.maxHp,
        mp: this.challenger.currentMp,
        isDefending: this.challenger.isDefending
      },
      opponent: {
        name: this.opponent.name,
        hp: this.opponent.currentHp,
        maxHp: this.opponent.maxHp,
        mp: this.opponent.currentMp,
        isDefending: this.opponent.isDefending
      },
      turn: this.currentTurn,
      isComplete: this.isComplete,
      lastActions: this.battleLog.slice(-2)
    };
  }
}

export default BattleEngine;
