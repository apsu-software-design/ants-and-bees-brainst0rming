import {AntColony, Place} from './game';

/**
 * Abstract class for all Ants and Bees.
 */
export abstract class Insect {
  readonly name:string;

  constructor(protected armor:number, protected place:Place){}

  getName():string { return this.name; }
  getArmor():number { return this.armor; }
  getPlace() { return this.place; }
  setPlace(place:Place){ this.place = place; }

  /**
   * Reduces an Insect's armor by a specified amount.
   * Insect dies if armor value becomes 0 (or less).
   * Precondition: The amount the armor is deducted by must be a positive integer.
   * @param amount The amount for which the Insect's armor value will be deducted by.
   * @return true if the Insect dies, false otherwise.
   */
  reduceArmor(amount:number):boolean {
    this.armor -= amount;
    if(this.armor <= 0){
      console.log(this.toString()+' ran out of armor and expired');
      this.place.removeInsect(this);
      return true;
    }
    return false;
  }

  /**
   * Executes an Insect action. Action can be pertinent to the Ant colony depending on the Insect.
   * @param colony? The Ant colony of the game.
   */
  abstract act(colony?:AntColony):void;

  /**
   * A string representation of an Insect
   * @return A string containing the Insect's name and place.
   */
  toString():string {
    return this.name + '('+(this.place ? this.place.name : '')+')';
  }
}

/**
 * Bees are the enemies the player must defeat in the game.
 * Bees will fly down the tunnels towards the Ant Queen to the left.
 * Bees will sting any Ant blocking their path until the path is clear.
 * Bees will continually spawn in swarms until the Hive they came from becomes empty.
 */
export class Bee extends Insect {
  readonly name:string = 'Bee';
  private status:string;

  constructor(armor:number, private damage:number, place?:Place){
    super(armor, place);
  }

  /**
   * Sting an Ant, reducing the Ant's armor by the Bee's damage value.
   * The Ant dies if its armor value is reduced to 0 or below.
   * Precondition: The Ant must exist.
   * @param ant The Ant to be stung by the Bee.
   * @return true if the Ant died, false otherwise
   */
  sting(ant:Ant):boolean{
    console.log(this+ ' stings '+ant+'!');
    return ant.reduceArmor(this.damage);
  }

  /**
   * Is there an Ant in the same Place as this Bee?
   * @return true if an Ant exists at this Bee's Place, false otherwise
   */
  isBlocked():boolean {
    return this.place.getAnt() !== undefined;
  }

  setStatus(status:string) { this.status = status; }

  /**
   * Executes this Bee's action. This Bee will sting an Ant sharing the same Place if the Bee has not been recently hit with an IcyLeaf. If no Ant is present, the Bee advances 1 space if not recently hit with a StickyLeaf
   */
  act() {
    if(this.isBlocked()){
      if(this.status !== 'cold') {
        this.sting(this.place.getAnt());
      }
    }
    else if(this.armor > 0) {
      if(this.status !== 'stuck'){
        this.place.exitBee(this);
      }
    }    
    this.status = undefined;
  }
}

/**
 * The abstract class for all Ants.
 * Ants defend the Ant Colony. Each type of Ant has a special action that can be performed, as well has their own stats such as armor.
 * They can be given special items called boosts that can aid the Ant Colony defense.
 */
export abstract class Ant extends Insect {
  protected boost:string;
  constructor(armor:number, private foodCost:number = 0, place?:Place) {
    super(armor, place);
  }

  getFoodCost():number { return this.foodCost; }
  setBoost(boost:string) { 
    this.boost = boost; 
      console.log(this.toString()+' is given a '+boost);
  }
}

/**
 * Growers are ants that grow food and boosts.
 * Each turn a Grower will either produce 1 food for the colony or occasionally a boost that can be used on the Ants.
 * Growers cost 1 food to deploy and have 1 armor.
 */
export class GrowerAnt extends Ant {
  readonly name:string = "Grower";
  constructor() {
    super(1,1)
  }

  /**
   * The Grower can produce either 1 food or a boost, with the following probabilities:
   * 60% - +1 Food
   * 10% - FlyingLeaf
   * 10% - StickyLeaf
   * 10% - IcyLeaf
   *  5% - BugSpray
   *  5% - Nothing produced
   * Precondition: Ant Colony must exist.
   * @param colony The Ant Colony which will receive the Food or the Boost. 
   */
  act(colony:AntColony) {
    let roll = Math.random();
    if(roll < 0.6){
      colony.increaseFood(1);
    } else if(roll < 0.7) {
      colony.addBoost('FlyingLeaf');
    } else if(roll < 0.8) {
      colony.addBoost('StickyLeaf');
    } else if(roll < 0.9) {
      colony.addBoost('IcyLeaf');
    } else if(roll < 0.95) {
      colony.addBoost('BugSpray');
    }
  }  
}

/**
 * Throwers are Ants that throw leaves at Bees.
 * Each turn, they throw a leaf at the closest Bee within range.
 * They can throw different leaves when boosted.
 * Costs 4 Food and have 1 armor.
 */
export class ThrowerAnt extends Ant {
  readonly name:string = "Thrower";
  private damage:number = 1;

  constructor() {
    super(1,4);
  }

  /**
   * Executes Thrower action:
   * If Thrower has a FlyingLeaf Boost, Thrower range increased from standard 3 to 5 this turn.
   * If Thrower has a StickyLeaf Boost, target Bee becomes stuck for one turn
   * If Thrower has a IcyLeaf Boost, target Bee cannot sting for one turn
   * If Thrower has no Boost, standard leaf with no special effect will be thrown
   * Thrower will deal 1 damage to closest target Bee within range when throwing a leaf
   * If Thrower has a BugSpray, RIP to all Insects in the tunnel
   */
  act() {
    if(this.boost !== 'BugSpray'){
      let target;
      if(this.boost === 'FlyingLeaf')
        target = this.place.getClosestBee(5);
      else
        target = this.place.getClosestBee(3);

      if(target){
        console.log(this + ' throws a leaf at '+target);
        target.reduceArmor(this.damage);
    
        if(this.boost === 'StickyLeaf'){
          target.setStatus('stuck');
          console.log(target + ' is stuck!');
        }
        if(this.boost === 'IcyLeaf') {
          target.setStatus('cold');
          console.log(target + ' is cold!');
        }
        this.boost = undefined;
      }
    }
    else {
      console.log(this + ' sprays bug repellant everywhere!');
      let target = this.place.getClosestBee(0);
      while(target){
        target.reduceArmor(10);
        target = this.place.getClosestBee(0);
      }
      this.reduceArmor(10);
    }
  }
}

/**
 * Eaters are Ants that eat the Bees. They swallow the nearest Bee in the same tunnel, taking 3 turns to fully digest the Bee. They may cough out the Bee if the Bee has not been fully digested yet and the Eater has been attacked. Eaters cost 4 Food and have 2 armor.
 */
export class EaterAnt extends Ant {
  readonly name:string = "Eater";
  private turnsEating:number = 0;
  private stomach:Place = new Place('stomach');
  constructor() {
    super(2,4)
  }

  isFull():boolean {
    return this.stomach.getBees().length > 0;
  }

  /**
   * Executes Eater action:
   * If Eater's stomach is empty, Eater will eat the nearest Bee in the tunnel.
   * If three turns have passed since eating a Bee, the Eater's stomach becomes empty and the Eater can eat again next turn
   */
  act() {
    console.log("eating: "+this.turnsEating);
    if(this.turnsEating == 0){
      console.log("try to eat");
      let target = this.place.getClosestBee(0);
      if(target) {
        console.log(this + ' eats '+target+'!');
        this.place.removeBee(target);
        this.stomach.addBee(target);
        this.turnsEating = 1;
      }
    } else {
      if(this.turnsEating > 3){
        this.stomach.removeBee(this.stomach.getBees()[0]);
        this.turnsEating = 0;
      } 
      else 
        this.turnsEating++;
    }
  }  

  /**
   * Reduces the Eater's armor by a specified amount after being attacked by a Bee.
   * If the Eater is still alive and just ate a Bee previously, the Eater coughs out the Bee at its current Place. Additionally, the Eater will not be able to eat for another turn.
   * If the Eater dies and less than two turns have passed since eating a Bee, the Bee exits the Eater and is placed at the dead Eater's Place.
   * Precondition: amount > 0
   * @param amount The damage dealt to the Eater
   * @return true if Eater dies, false otherwise 
   */
  reduceArmor(amount:number):boolean {
    this.armor -= amount;
    console.log('armor reduced to: '+this.armor);
    if(this.armor > 0){
      if(this.turnsEating == 1){
        let eaten = this.stomach.getBees()[0];
        this.stomach.removeBee(eaten);
        this.place.addBee(eaten);
        console.log(this + ' coughs up '+eaten+'!');
        this.turnsEating = 3;
      }
    }
    else if(this.armor <= 0){
      if(this.turnsEating > 0 && this.turnsEating <= 2){
        let eaten = this.stomach.getBees()[0];
        this.stomach.removeBee(eaten);
        this.place.addBee(eaten);
        console.log(this + ' coughs up '+eaten+'!');
      }
      return super.reduceArmor(amount); // Remove dead Eater
    }
    return false;
  }
}

/**
 * Scuba Ants are like Throwers, except Scuba Ants can also survive in water tunnels. They cost 5 Food and have 1 armor.
 */
export class ScubaAnt extends Ant {
  readonly name:string = "Scuba";
  private damage:number = 1;

  constructor() {
    super(1,5)
  }

  /**
   * Executes Scuba Ant action:
   * If Scuba Ant has a FlyingLeaf Boost, Scuba Ant range increased from standard 3 to 5 this turn.
   * If Scuba Ant has a StickyLeaf Boost, target Bee becomes stuck for one turn
   * If Scuba Ant has a IcyLeaf Boost, target Bee cannot sting for one turn
   * If Scuba Ant has no Boost, standard leaf with no special effect will be thrown
   * Scuba Ant will deal 1 damage to closest target Bee within range when throwing a leaf
   * If Scuba Ant has a BugSpray, RIP to all Insects in the tunnel		   
   */
  act() {
    if(this.boost !== 'BugSpray'){
      let target;
      if(this.boost === 'FlyingLeaf')
        target = this.place.getClosestBee(5);
      else
        target = this.place.getClosestBee(3);

      if(target){
        console.log(this + ' throws a leaf at '+target);
        target.reduceArmor(this.damage);
    
        if(this.boost === 'StickyLeaf'){
          target.setStatus('stuck');
          console.log(target + ' is stuck!');
        }
        if(this.boost === 'IcyLeaf') {
          target.setStatus('cold');
          console.log(target + ' is cold!');
        }
        this.boost = undefined;
      }
    }
    else {
      console.log(this + ' sprays bug repellant everywhere!');
      let target = this.place.getClosestBee(0);
      while(target){
        target.reduceArmor(10);
        target = this.place.getClosestBee(0);
      }
      this.reduceArmor(10);
    }
  }
}

/**
 * Guard Ants protect other Ants, occupying the same tunnel as them. They take any hits before the Ant they protect. They cost 4 Food and have 2 armor.
 */
export class GuardAnt extends Ant {
  readonly name:string = "Guard";

  constructor() {
    super(2,4)
  }

  getGuarded():Ant {
    return this.place.getGuardedAnt();
  }

  act() {}
}
