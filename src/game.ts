import {Insect, Bee, Ant, GrowerAnt, ThrowerAnt, EaterAnt, ScubaAnt, GuardAnt} from './ants';

class Place {
  protected ant:Ant; // Is there a non-Guard Ant at the Place?
  protected guard:GuardAnt; // Is there a Guard Ant at the Place?
  protected bees:Bee[] = []; // Are there Bees at the Place?

  constructor(readonly name:string,
              protected readonly water = false,
              private exit?:Place, 
              private entrance?:Place) {}

  getExit():Place { return this.exit; }

  setEntrance(place:Place){ this.entrance = place; }

  isWater():boolean { return this.water; }

  /**
   * Returns the Ant at this Place.
   * @return Guard Ant if there is one, otherwise the Ant (undefined if Ant does not exist either)
   */
  getAnt():Ant { 
    if(this.guard) 
      return this.guard;
    else 
      return this.ant;
  }

  getGuardedAnt():Ant {
    return this.ant;
  }

  getBees():Bee[] { return this.bees; }

  /**
   * Returns the closest Bee within a specified distance interval
   * @param maxDistance Maximum search distance from original grid
   * @param minDistance Minimum search distance from original grid
   * @return The closest Bee if it exists, otherwise undefined
   */
  getClosestBee(maxDistance:number, minDistance:number = 0):Bee {
    let p:Place = this; // Start at current grid
    for(let dist = 0; p!==undefined && dist <= maxDistance; dist++) {
      if(dist >= minDistance && p.bees.length > 0) { // Are there Bees at Place p?
	return p.bees[0];
      }
      p = p.entrance; // Shift Place right if no Bees found
    }
    return undefined;
  }

  /**
   * Adds an Ant to this Place
   * Precondition: ant must be an Ant
   * @param ant The Ant to be assigned to this grid
   * @return true if and has been added, false if attempt to add Guard Ant when Guard Ant already exist in current Place OR if attempt to add non-Guard Ant when non-Guard Ant already exist in current Place.
   */
  addAnt(ant:Ant):boolean {
    if(ant instanceof GuardAnt) {
      if(this.guard === undefined){
        this.guard = ant;
        this.guard.setPlace(this); // Set the Guard Ant's Place to this Place
        return true;
      }
    }
    else 
      if(this.ant === undefined) {
        this.ant = ant;
        this.ant.setPlace(this); // Set the non-Guard Ant's Place to this Place
        return true;
      }
    return false;
  }

  /**
   * Remove the present Ant from this Place, with the Guard Ant being removed first if present
   * Precondition: There is currently an Ant in this Place.
   * @return The Ant that was removed
   */
  removeAnt():Ant {
    if(this.guard !== undefined){
      let guard = this.guard;
      this.guard = undefined;
      return guard;
    }
    else {
      let ant = this.ant;
      this.ant = undefined;
      return ant;
    }
  }

  addBee(bee:Bee):void {
    this.bees.push(bee);
    bee.setPlace(this);
  }

  removeBee(bee:Bee):void {
    var index = this.bees.indexOf(bee);
    if(index >= 0){
      this.bees.splice(index,1);
      bee.setPlace(undefined);
    }
  }

  removeAllBees():void {
    this.bees.forEach((bee) => bee.setPlace(undefined) );
    this.bees = [];
  }

  /**
   * Advance the specified Bee forward one grid
   * Precondition: bee is a Bee
   * @param bee The Bee being advanced
   */
  exitBee(bee:Bee):void {
    this.removeBee(bee);
    this.exit.addBee(bee);  
  }

  removeInsect(insect:Insect) {
    if(insect instanceof Ant){
      this.removeAnt();
    }
    else if(insect instanceof Bee){
      this.removeBee(insect);
    }
  }

  /**
   * Remove all non-Scuba Ants from this Place, IF this Place is filled with water.
   */
  act() {
    if(this.water){
      if(this.guard){
        this.removeAnt();
      }
      if(!(this.ant instanceof ScubaAnt)){
        this.removeAnt();
      }
    }
  }
}

/**
 * Where all the Bees come from.
 */
class Hive extends Place {
  private waves:{[index:number]:Bee[]} = {} // key-value pair: attackTurn-Bee[]

  /**
   * Creates the Hive with name 'Hive'
   * Precondition: All parameters must be positive integers
   * @param beeArmor Bee armor rating
   * @param beeDamage Bee damage rating
   */
  constructor(private beeArmor:number, private beeDamage:number){
    super('Hive');
  }

  /**
   * Creates attack waves of Bees and times them to a specified turn
   * Precondition: attackTurn >= 0 && numBees > 0
   * @param attackTurn The turn to unleash the attack wave
   * @param numBees The number of Bees to deploy during the attack wave
   * @return The Hive itself
   */
  addWave(attackTurn:number, numBees:number):Hive {
    let wave:Bee[] = [];
    for(let i=0; i<numBees; i++) {
      let bee = new Bee(this.beeArmor, this.beeDamage, this);
      this.addBee(bee); // Add Bee to Hive
      wave.push(bee);
    }
    this.waves[attackTurn] = wave;
    return this;
  }
 
  /**
   * Unleash the attack waves of Bees! Bees will appear at randomly chosen Ant Colony Entrances.
   * Precondition: colony !== null && colony !== undefined && currentTurn >= 0
   * @param colony The Ant Colony targeted
   * @param currentTurn The current turn
   * @return The array of Bees being deployed to attack the Ant Colony, can be empty. 
   */
  invade(colony:AntColony, currentTurn:number): Bee[]{
    if(this.waves[currentTurn] !== undefined) {
      this.waves[currentTurn].forEach((bee) => {
        this.removeBee(bee); // Remove Bee from Hive
        let entrances:Place[] = colony.getEntrances();
        let randEntrance:number = Math.floor(Math.random()*entrances.length);
        entrances[randEntrance].addBee(bee); // ATTACK!
      });
      return this.waves[currentTurn];
    }
    else{
      return [];
    }    
  }
}

/**
 * The Ant Colony is the objective the player must defend.
 * It is divided into a set of tunnels, each divided into sections. Only one Ant can occupy each section at a time, except for Guard Ants.
 * Some tunnel sections may be filled with water, which is impassable to most Ants.
 * The Ant Colony has a stock of Food which is used to deploy Ants, as well as Boosts which have special effects when given to Ants.
 */
class AntColony { 
  private food:number;
  private places:Place[][] = [];                       // A 2D Place array representing the game board.
  private beeEntrances:Place[] = [];                   // Places on the board Bees enter the fray.
  private queenPlace:Place = new Place('Ant Queen');
  private boosts:{[index:string]:number} = {'FlyingLeaf':1,'StickyLeaf':1,'IcyLeaf':1,'BugSpray':0}

  /**
   * Creates the Ant Colony and initializes the game board.
   * Precondition: First three parameters must be positive integers, last parameter must be non-negative.
   * @param startingFood The starting amount of Food
   * @param numTunnels The number of tunnels
   * @param tunnelLength The length of the tunnels
   * @param moatFrequency The frequency of water-filled tunnel sections
   */
  constructor(startingFood:number, numTunnels:number, tunnelLength:number, moatFrequency=0){
    this.food = startingFood;

    let prev:Place;
    for(let tunnel=0; tunnel < numTunnels; tunnel++) { // numTunnels = # of rows
      let curr:Place = this.queenPlace;
      this.places[tunnel] = [];
      for(let step=0; step < tunnelLength; step++) { // tunnelLength = # of columns
        let typeName = 'tunnel';
        if(moatFrequency !== 0 && (step+1)%moatFrequency === 0) { // Every moatFrequency'th tunnel section within each tunnel is filled with water.
          typeName = 'water';
	}
				
	prev = curr;
        let locationId:string = tunnel+','+step; // Tunnel coordinates [row, column]; top-left corner is [0,0]
        curr = new Place(typeName+'['+locationId+']', typeName=='water', prev); // Initialize each grid in the game board
        prev.setEntrance(curr); // Entrance is grid to the right, Exit is grid to the left
	this.places[tunnel][step] = curr;
      }
      this.beeEntrances.push(curr); // Bee spawns at the rightmost column
    }
  }

  getFood():number { return this.food; }

  increaseFood(amount:number):void { this.food += amount; }

  getPlaces():Place[][] { return this.places; }

  getEntrances():Place[] { return this.beeEntrances; }

  getQueenPlace():Place { return this.queenPlace; }

  queenHasBees():boolean { return this.queenPlace.getBees().length > 0; }

  getBoosts():{[index:string]:number} { return this.boosts; }

  /**
   * Adds a Boost to the Ant Colony.
   * @param boost The Boost to be added
   */
  addBoost(boost:string){
    if(this.boosts[boost] === undefined){ // If the boost has never been added before, initialize boost key-value pair and set value to 0.
      this.boosts[boost] = 0;
    }
    this.boosts[boost] = this.boosts[boost]+1;
    console.log('Found a '+boost+'!');
  }

  /**
   * Deploys an Ant at a specified Place on the game board.
   * Precondition: Ant and Place exist
   * @param ant The Ant to be deployed
   * @param place The Place the Ant will be deployed to
   * @return If not enough Food to cover deployment costs, return 'not enough food.' Then if Place has an Insect, return 'tunnel already occupied.' Then return undefined.
   */
  deployAnt(ant:Ant, place:Place):string {
    if(this.food >= ant.getFoodCost()){
      let success = place.addAnt(ant);
      if(success){
        this.food -= ant.getFoodCost();
        return undefined;
      }
      return 'tunnel already occupied';
    }
    return 'not enough food';
  }

  removeAnt(place:Place){
    place.removeAnt();
  }

  /**
   * Applies a specified Boost to an Ant at a specified Place.
   * Precondition: Place must exist
   * @param boost The Boost to be applied
   * @param place The Place where the Ant is and where the Boost will be applied
   * @return If the Ant Colony does not have the Boost (or the Boost does not exist), return 'no such boost.' Then if the Place does not have an Ant, return 'no Ant at location.' Then return undefined.
   */
  applyBoost(boost:string, place:Place):string {
    if(this.boosts[boost] === undefined || this.boosts[boost] < 1) {
      return 'no such boost';
    }
    let ant:Ant = place.getAnt();
    if(!ant) {
      return 'no Ant at location' 
    }
    ant.setBoost(boost);
    return undefined;
  }

  /**
   * Executes all Ant actions on the board.
   */
  antsAct() {
    this.getAllAnts().forEach((ant) => {
      if(ant instanceof GuardAnt) {
        let guarded = ant.getGuarded();
        if(guarded)
          guarded.act(this);
      }
      ant.act(this);
    });    
  }

  /**
   * Executes all Bee actions on the board.
   */
  beesAct() {
    this.getAllBees().forEach((bee) => {
      bee.act();
    });
  }

  /**
   * Rest In Peace all non-Scuba Ants on water tiles :(
   */
  placesAct() {
    for(let i=0; i<this.places.length; i++) {
      for(let j=0; j<this.places[i].length; j++) {
        this.places[i][j].act();
      }
    }    
  }

  getAllAnts():Ant[] {
    let ants = [];
    for(let i=0; i<this.places.length; i++) {
      for(let j=0; j<this.places[i].length; j++) {
        if(this.places[i][j].getAnt() !== undefined) {
          ants.push(this.places[i][j].getAnt());
        }
      }
    }
    return ants;
  }

  getAllBees():Bee[] {
    var bees = [];
    for(var i=0; i<this.places.length; i++){
      for(var j=0; j<this.places[i].length; j++){
        bees = bees.concat(this.places[i][j].getBees());
      }
    }
    return bees;
  }
}

/**
 * Controls the state of the game. Responsible for progressing the game.
 */
class AntGame {
  private turn:number = 0;
  constructor(private colony:AntColony, private hive:Hive){}

  /**
   * Executes all actions from all Ants, Bees, and Places. Deploys invading Bees waves with a turn timer corresponding to the current turn.
   */
  takeTurn() {
    console.log('');
    this.colony.antsAct();
    this.colony.beesAct();
    this.colony.placesAct();
    this.hive.invade(this.colony, this.turn);
    this.turn++;
    console.log('');
  }

  getTurn() { return this.turn; }

  /**
   * Is the game won or lost?
   * @return true if no Bees left, false if the Ant Queen has Bees, undefined otherwise.
   */
  gameIsWon():boolean|undefined {
    if(this.colony.queenHasBees()){ // Uh Oh our Queen...
      return false;
    }
    else if(this.colony.getAllBees().length + this.hive.getBees().length === 0) { // Are there no Bees left?
      return true;
    }   
    return undefined;
  }

  /**
   * Deploy an Ant of a specified type to a specified coordinate on the game board
   * @param antType The type of Ant
   * @param placeCoordinates Coordinates [row, column] in which the Ant should be deployed to
   * @return 'unknown ant type' for invalid Ant types, 'illegal location' for invalid coordinates, or this.colony.deployAnt(ant, place) otherwise.
   */
  deployAnt(antType:string, placeCoordinates:string):string {
    let ant;
    switch(antType.toLowerCase()) {
      case "grower":
        ant = new GrowerAnt(); break;
      case "thrower":
        ant = new ThrowerAnt(); break;
      case "eater":
        ant = new EaterAnt(); break;
      case "scuba":
        ant = new ScubaAnt(); break;
      case "guard":
        ant = new GuardAnt(); break;
      default:
        return 'unknown ant type';
    }

    try {
      let coords = placeCoordinates.split(',');
      let place:Place = this.colony.getPlaces()[coords[0]][coords[1]];
      return this.colony.deployAnt(ant, place);
    } catch(e) {
      return 'illegal location';
    }
  }

  /**
   * Remove Ant at specified coordinates.
   * @param placeCoordinates The grid location where an Ant is to be removed
   * @return undefined if coordinates valid, 'illegal location' otherwise
   */
  removeAnt(placeCoordinates:string):string {
    try {
      let coords = placeCoordinates.split(',');
      let place:Place = this.colony.getPlaces()[coords[0]][coords[1]];
      place.removeAnt();
      return undefined;
    }catch(e){
      return 'illegal location';
    }    
  }

  /**
   * Boost an Ant at a specified coordinate
   * @param boostType The Boost type
   * @param placeCoordinates The coordinates where the Ant to be boosted is
   * @return 'illegal location' if invalid coordinates, this.colony.applyBoost(boostType, place) otherwise
   */
  boostAnt(boostType:string, placeCoordinates:string):string {
    try {
      let coords = placeCoordinates.split(',');
      let place:Place = this.colony.getPlaces()[coords[0]][coords[1]];
      return this.colony.applyBoost(boostType,place);
    }catch(e){
      return 'illegal location';
    }    
  }

  getPlaces():Place[][] { return this.colony.getPlaces(); }
  getFood():number { return this.colony.getFood(); }
  getHiveBeesCount():number { return this.hive.getBees().length; }

  /**
   * Return the Boost names whose quantity in the Ant Colony is over 0
   * @return A string array containing the names of the Boosts that the Ant Colony has (quantity > 0)
   */
  getBoostNames():string[] { 
    let boosts = this.colony.getBoosts();
    return Object.keys(boosts).filter((boost:string) => {
      return boosts[boost] > 0;
    }); 
  }
}

export { AntGame, Place, Hive, AntColony }
