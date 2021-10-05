import {AntGame, AntColony, Place, Hive} from './game';
import {Ant, EaterAnt, GuardAnt} from './ants';

import vorpal = require('vorpal');
import chalk = require('chalk');
import _ = require('lodash');

/**
 * The Vorpal library for command-line interaction
 */
const Vorpal = vorpal();

export function showMapOf(game:AntGame){
  console.log(getMap(game));
}

/**
 * Returns a string denoting the current game state
 * Preconditions: game !== null or undefined
 * @param game The current game being played
 * @return A string denoting the current game state
 */
function getMap(game:AntGame) {
  let places:Place[][] = game.getPlaces();
  let tunnelLength = places[0].length;
  let beeIcon = chalk.bgYellow.black('B'); // Yellow background with black font 'B' assigned as a icon for the Bees
   
  let map = '';

  map += chalk.bold('The Colony is under attack!\n'); // argument is returned, but with bold font
  map += `Turn: ${game.getTurn()}, Food: ${game.getFood()}, Boosts available: [${game.getBoostNames()}]\n`;
  map += '     '+_.range(0,tunnelLength).join('    ')+'      Hive'+'\n'; // Add to the string the numbers in the interval [0, tunnelLength) with a few spaces in between.
   
  for(let i=0; i<places.length; i++){ // Iterate over the rows of the game board
    map += '    '+Array(tunnelLength+1).join('====='); // Big sequence of = just below the numbers.
    
    if(i===0){ // Topmost row after the numbers
      map += '    ';
      let hiveBeeCount = game.getHiveBeesCount();
      if(hiveBeeCount > 0){
        map += beeIcon;
        map += (hiveBeeCount > 1 ? hiveBeeCount : ' '); // Add Hive information to the string, as long as there are still Bees in the Hive
      }
    }
    map += '\n';

    map += i+')  '; // Row labels
      
    for(let j=0; j<places[i].length; j++){ // Iterate through the columns 
      let place:Place = places[i][j];

      map += iconFor(place.getAnt()); // Add in symbols for the different Ant types
      map += ' '; 

      if(place.getBees().length > 0){
        map += beeIcon; // Add in the Bee icon
        map += (place.getBees().length > 1 ? place.getBees().length : ' '); // And the number of Bees at the current Place
      } else {
        map += '  ';
      }
      map += ' '; 
    }
    map += '\n    ';
    for(let j=0; j<places[i].length; j++){ // More column iteration
      let place = places[i][j];
      if(place.isWater()){
        map += chalk.bgCyan('~~~~')+' '; // Cyan background to denote water Places
      } else {
        map += '==== ';
      }
    }
    map += '\n';
  }
  map += '     '+_.range(0,tunnelLength).join('    ')+'\n'; // Add the numbers denoting the columns to the bottom of the game board

  return map;
}

/**
 * Returns a unique icon for each Ant type
 * @param ant The Ant being assigned an icon
 * @return A uniquely formatted string
 */
function iconFor(ant:Ant){
  if(ant === undefined){ return ' ' };
  let icon:string;
  switch(ant.name){
    case "Grower":
      icon = chalk.green('G'); break; // Green letter 'G' for Growers
    case "Thrower":
      icon = chalk.red('T'); break; // Red letter 'T' for Throwers
    case "Eater":
      if((<EaterAnt>ant).isFull())
        icon = chalk.yellow.bgMagenta('E'); // Yellow letter 'E' with magenta background for Eaters whose stomachs are full
      else
        icon = chalk.magenta('E'); // Magenta letter 'E' for Eaters who can eat
      break;
    case "Scuba":
      icon = chalk.cyan('S'); break; // Cyan letter 'S' for Scubas
    case "Guard":
      let guarded:Ant = (<GuardAnt>ant).getGuarded();
      if(guarded){
        icon = chalk.underline(iconFor(guarded)); break; // Underline any Ant being protected by a Guard Ant.
      } else {
        icon = chalk.underline('x'); break; // Underlined letter 'x' for solo Guard Ants
      }
    default:
      icon = '?'; // We have no idea what kind of Ant it is.
  }
  return icon;
}

/**
 * Start the game.
 * Precondition: game must be an AntGame
 * @param game The state of the game under continuous update
 */
export function play(game:AntGame) {
  Vorpal
    .delimiter(chalk.green('AvB $')) // Sets the prompt delimiter to 'AvB $' and turns its letters green
    .log(getMap(game))               // Display current game state
    .show();                         // Attach command line interface prompt to this Vorpal instance
    
  Vorpal
    .command('show', 'Shows the current game board.') // Adds the 'show' command with description 'Shows the current game board.' which is displayed in the help menu
    .action(function(args, callback){                 // The 'show' command now displays the current game state
      Vorpal.log(getMap(game));
      callback();                                     // Need to callback so that Vorpal returns its CLI prompt after command execution.
    });

  Vorpal
    .command('deploy <antType> <tunnel>', 'Deploys an ant to tunnel (as "row,col" eg. "0,6").') // Adds the 'deploy <antType> <tunnel>' command with description 'Deploys an ant to tunnel (as "row,col" eg. "0,6").' All arguments required
    .alias('add', 'd')                                                                          // Provides the 'add' and 'd' aliases to the 'deploy' command
    .autocomplete(['Grower','Thrower','Eater','Scuba','Guard'])                                 // Enables tabbed autocomplete for these args
    .action(function(args, callback) {                                                          // The 'deploy' command will deploy an Ant of type <antType> at the coordinates <tunnel>
      let error = game.deployAnt(args.antType, args.tunnel)
      if(error){                                                                                // If either <antType> or <tunnel> are invalid, an error message is printed.
        Vorpal.log(`Invalid deployment: ${error}.`);
      }
      else {
        Vorpal.log(getMap(game));                                                               // If the Ant is deployed, the updated game state is displayed
      }
      callback();                                                                               // Return to Vorpal CLI prompt
    });

  Vorpal
    .command('remove <tunnel>', 'Removes the ant from the tunnel (as "row,col" eg. "0,6").')    // Adds 'remove' command that removes an Ant from a provided coordinate
    .alias('rm')                                                                                // Alias 'rm' equivalent to 'remove'
    .action(function(args, callback){                                                           
      let error = game.removeAnt(args.tunnel);                                                  // 'remove' tries to remove the Ant at provided coordinate <tunnel>
      if(error){                                                                                // Display error message if removal is invalid
        Vorpal.log(`Invalid removal: ${error}.`);
      }
      else {
        Vorpal.log(getMap(game));                                                               // Display updated game state after successful removal
      }
      callback();                                                                               // Return to Vorpal CLI prompt
    });

  Vorpal
    .command('boost <boost> <tunnel>', 'Applies a boost to the ant in a tunnel (as "row,col" eg. "0,6")')
    .alias('b')                                                                                 // 'boost' command with alias 'b'
    .autocomplete({data:() => game.getBoostNames()})                                            // Boosts available for tab autocompletion
    .action(function(args, callback){                                                           // Main execution of command
      let error = game.boostAnt(args.boost, args.tunnel);                                       // 'boost' will attempt to boost an Ant with a boost labeled <boost> at coordinates <tunnel>
      if(error){                                            
        Vorpal.log(`Invalid boost: ${error}`);                                                  // If it fails, display error message
      }
      callback();                                                                               // Return to Vorpal CLI prompt
    })

  Vorpal
    .command('turn', 'Ends the current turn. Ants and bees will act.')                          // 'turn' command that ends the turn
    .alias('end turn', 'take turn','t')                                                         // Aliases 'end turn', 'take turn', and 't' assigned to 'turn'
    .action(function(args, callback){                                                           // Main execution of command
      game.takeTurn();                                                                          // Executes all actions from all Ants, Bees, and Places. Deploys invading Bees waves with a turn timer corresponding to the current turn.
      Vorpal.log(getMap(game));                                                                 // Display updated game state
      let won:boolean = game.gameIsWon();                                                       // Determine whether win/loss conditions have been reached
      if(won === true){
        Vorpal.log(chalk.green('Yaaaay---\nAll bees are vanquished. You win!\n'));              // Win condition: Congratulatory message displayed in green letters
      }
      else if(won === false){
        Vorpal.log(chalk.yellow('Bzzzzz---\nThe ant queen has perished! Please try again.\n')); // Loss condition: Message displayed in yellow letters
      }
      else {
        callback();                                                                             // Return to Vorpal CLI prompt if win/loss conditions have not been reached
      }
    });
}
